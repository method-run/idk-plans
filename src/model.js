import path from 'node:path';
import { normalizeLabel } from './parse.js';
import { ruleSetting } from './config.js';

export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const KINDS = ['system', 'module', 'feature', 'concern', 'guide', 'reference', 'plan'];
export const STATES = ['todo', 'doing', 'blocked', 'done', 'deferred', 'dropped'];
const OPEN = new Set(['todo', 'doing', 'blocked']);
const OUT_OF_SCOPE = new Set(['deferred', 'dropped']);
const SCOPE_STATUSES = new Set(['deferred', 'dropped']);

export function titleFromId(id) {
  const words = id.split('-');
  return [words[0][0].toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ');
}

/** The mark that a task with subtasks should have, from its leaf states. */
export function aggregateState(states) {
  const inScope = states.filter((s) => !OUT_OF_SCOPE.has(s));
  if (!inScope.length) return states.every((s) => s === 'dropped') ? 'dropped' : 'deferred';
  if (inScope.every((s) => s === 'done')) return 'done';
  if (inScope.includes('blocked')) return 'blocked';
  if (inScope.some((s) => s === 'done' || s === 'doing')) return 'doing';
  return 'todo';
}

export function summarize(states) {
  const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
  for (const s of states) counts[s]++;
  const done = counts.done;
  const open = counts.todo + counts.doing + counts.blocked;
  const scope = done + open;
  return {
    done,
    open,
    scope,
    percent: scope ? Math.floor((100 * done) / scope) : null,
    states: counts,
  };
}

function isExternal(target) {
  return /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);
}

/**
 * Build the model from parsed files.
 *
 * @param {object} args
 * @param {object} args.config resolved configuration
 * @param {object[]} args.parsed results of parseMarkdown
 * @param {(rel: string) => boolean} args.exists whether a project path exists
 */
export function buildModel({ config, parsed, exists }) {
  const problems = [];
  const report = (rule, file, line, message) => {
    const { severity } = ruleSetting(config.rules[rule] ?? 'error');
    if (severity === 'off') return;
    problems.push({ rule, severity, file, line: line == null ? null : line + 1, message });
  };

  const primary = config.primaryTree;
  const treeNames = Object.keys(config.trees);

  // ── 1. Nodes from files ───────────────────────────────────────────
  const nodes = new Map();
  const byFile = new Map();

  for (const doc of parsed) {
    const fm = doc.frontmatter;
    if (fm?.error) {
      report('frontmatter', doc.file, 0, fm.error);
      continue;
    }
    const data = fm?.data ?? {};
    const isConfigRoot = config.root?.file === doc.file;
    if (!data.id && !isConfigRoot) {
      report('orphan-file', doc.file, 0, 'Markdown file is not a node (no frontmatter id)');
      continue;
    }
    const node = nodeFromFrontmatter(doc, data, isConfigRoot ? config.root : null, report, treeNames, primary);
    if (!node) continue;
    if (nodes.has(node.id)) {
      report('duplicate-id', doc.file, 0, `id "${node.id}" is also used by ${nodes.get(node.id).file}`);
      continue;
    }
    nodes.set(node.id, node);
    byFile.set(doc.file, node);
  }

  // ── 2. Root ───────────────────────────────────────────────────────
  let rootId = config.root?.id ?? null;
  if (rootId && !nodes.has(rootId)) {
    const fromFile = config.root?.file && byFile.get(config.root.file);
    rootId = fromFile ? fromFile.id : null;
  }
  if (!rootId) {
    const candidates = [...nodes.values()].filter((n) => !n.declared[primary]?.length);
    if (candidates.length === 1) rootId = candidates[0].id;
    else rootId = candidates.find((n) => n.file === 'README.md')?.id ?? candidates[0]?.id ?? null;
  }
  for (const node of nodes.values()) {
    if (node.id !== rootId && !node.declared[primary]?.length) {
      report('no-primary-parent', node.file, 0, `node "${node.id}" has no parent`);
    }
  }

  // ── 3. Trees: parents, virtual nodes, positions ──────────────────
  const trees = {};
  for (const tree of treeNames) {
    const top = tree === primary ? rootId : tree;
    trees[tree] = { title: config.trees[tree].title ?? titleFromId(tree), top, parents: new Map(), children: new Map() };
  }

  // Ids that some multi-id path or a configured group names. Only these can be virtual.
  const virtualAllowed = new Set(treeNames.filter((t) => t !== primary));
  const groupPaths = {};
  for (const tree of treeNames) {
    groupPaths[tree] = [];
    for (const raw of config.trees[tree].groups ?? []) {
      const p = parsePath(raw);
      if (!p) { report('frontmatter', 'idk-plans.config.json', null, `group "${raw}" (${tree}) is not a valid id or dot-separated path`); continue; }
      groupPaths[tree].push({ raw, path: p });
      p.forEach((id) => virtualAllowed.add(id));
    }
  }
  for (const node of nodes.values()) {
    for (const tree of treeNames) {
      for (const ref of node.declared[tree] ?? []) {
        if (ref.path.length > 1) ref.path.forEach((id) => virtualAllowed.add(id));
      }
    }
  }

  const ensureVirtual = (id) => {
    if (nodes.has(id)) return true;
    if (!virtualAllowed.has(id)) return false;
    nodes.set(id, {
      id, title: titleFromId(id), summary: null, kind: 'concern', file: null, virtual: true,
      status: null, code: [], aliases: [], order: null, declared: {}, doc: null, line: null,
    });
    return true;
  };

  for (const tree of treeNames) {
    const t = trees[tree];
    if (t.top && ensureVirtual(t.top) && nodes.get(t.top).virtual) nodes.get(t.top).title = t.title;
    const declaredParents = new Map(); // id → [parent ids]
    const asserted = new Map(); // id → [{ parent, file, line }]

    for (const node of [...nodes.values()]) {
      for (const ref of node.declared[tree] ?? []) {
        const ids = ref.path;
        if (!ensureVirtual(ids.at(-1))) {
          report('missing-parent', node.file, node.line, `parent "${ids.at(-1)}" (${tree}) does not exist`);
          continue;
        }
        if (!declaredParents.has(node.id)) declaredParents.set(node.id, []);
        declaredParents.get(node.id).push(ids.at(-1));
        for (let i = 1; i < ids.length; i++) {
          ensureVirtual(ids[i - 1]);
          if (!asserted.has(ids[i])) asserted.set(ids[i], []);
          asserted.get(ids[i]).push({ parent: ids[i - 1], file: node.file, line: node.line, path: ref.raw });
        }
      }
    }

    for (const { raw, path: ids } of groupPaths[tree]) {
      ids.forEach((id) => ensureVirtual(id));
      if (!declaredParents.has(ids[0]) && !asserted.has(ids[0])) declaredParents.set(ids[0], []);
      for (let i = 1; i < ids.length; i++) {
        if (!asserted.has(ids[i])) asserted.set(ids[i], []);
        asserted.get(ids[i]).push({ parent: ids[i - 1], file: 'idk-plans.config.json', line: null, path: raw });
      }
    }

    for (const [id, claims] of asserted) {
      const declared = declaredParents.get(id);
      if (declared) {
        for (const c of claims) {
          if (!declared.includes(c.parent)) {
            report('path-mismatch', c.file, c.line,
              `path "${c.path}" puts "${id}" under "${c.parent}", but "${id}" says its ${tree} parent is "${declared.join('", "')}"`);
          }
        }
      } else {
        const distinct = [...new Set(claims.map((c) => c.parent))];
        if (distinct.length > 1) {
          for (const c of claims) {
            report('path-mismatch', c.file, c.line,
              `paths disagree about the ${tree} parent of "${id}": ${distinct.join(', ')}`);
          }
        }
        declaredParents.set(id, [claims[0].parent]);
      }
    }

    // Everything mentioned in this tree, but without a parent, goes under the top.
    const members = new Set([...declaredParents.keys(), ...[...declaredParents.values()].flat()]);
    for (const id of members) {
      if (id === t.top) continue;
      const ps = declaredParents.get(id);
      if (ps?.length) t.parents.set(id, [...new Set(ps)]);
      else if (tree !== primary || nodes.get(id)?.virtual) t.parents.set(id, [t.top]);
    }

    for (const [id, ps] of t.parents) {
      for (const p of ps) {
        if (!t.children.has(p)) t.children.set(p, []);
        t.children.get(p).push(id);
      }
    }
    for (const [p, kids] of t.children) t.children.set(p, sortSiblings(kids, nodes));

    // Cycles.
    const state = new Map();
    const visit = (id, trail) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'active') {
        const node = nodes.get(id);
        report('cycle', node?.file ?? null, node?.line ?? null, `${tree} tree has a cycle: ${[...trail, id].join(' → ')}`);
        return;
      }
      state.set(id, 'active');
      for (const p of t.parents.get(id) ?? []) visit(p, [...trail, id]);
      state.set(id, 'done');
    };
    for (const id of t.parents.keys()) visit(id, []);
  }

  // ── 4. Tasks and status ───────────────────────────────────────────
  const pt = trees[primary];
  const scopeOverride = (id) => {
    const seen = new Set();
    for (let cur = id; cur && !seen.has(cur); cur = pt.parents.get(cur)?.[0]) {
      seen.add(cur);
      const status = nodes.get(cur)?.status;
      if (SCOPE_STATUSES.has(status)) return status;
    }
    return null;
  };

  for (const node of nodes.values()) {
    node.tasks = [];
    const docTasks = node.doc?.tasks ?? [];
    const hasChildren = (pt.children.get(node.id) ?? []).length > 0;

    for (const task of docTasks) {
      if (!task.children.length) continue;
      const leafStates = leafDescendants(docTasks, task).map((t) => t.state);
      const expected = aggregateState(leafStates);
      if (expected !== task.state) {
        report('task-parent-mismatch', node.file, task.line,
          `task is "${task.state}" but its subtasks make it "${expected}"`);
      }
    }

    const counted = docTasks.filter((t) => !t.children.length);
    if (node.status && (counted.length || hasChildren) && !SCOPE_STATUSES.has(node.status)) {
      report('bad-status', node.file, node.line,
        `status "${node.status}" is only allowed on a leaf node without tasks; use tasks, or "deferred"/"dropped"`);
    }
    const override = scopeOverride(node.id);
    for (const t of counted) {
      node.tasks.push({ text: t.text, state: override ?? t.state, line: t.line + 1 });
    }
    if (!counted.length && !hasChildren && node.status) {
      node.tasks.push({ text: `(status: ${node.status})`, state: override ?? node.status, line: null, implicit: true });
    }
    if (!counted.length && !hasChildren && !node.status && !node.virtual && node.id !== rootId
      && !['guide', 'reference', 'system'].includes(node.kind)) {
      report('no-progress', node.file, node.line, `leaf node "${node.id}" has no tasks and no status`);
    }
  }

  // ── 5. Rollups ────────────────────────────────────────────────────
  for (const tree of treeNames) {
    const t = trees[tree];
    const memo = new Map();
    const collect = (id, active = new Set()) => {
      if (memo.has(id)) return memo.get(id);
      if (active.has(id)) return new Map();
      active.add(id);
      const set = new Map();
      (nodes.get(id)?.tasks ?? []).forEach((task, i) => set.set(`${id}#${i}`, task.state));
      for (const kid of t.children.get(id) ?? []) {
        for (const [k, v] of collect(kid, active)) set.set(k, v);
      }
      active.delete(id);
      memo.set(id, set);
      return set;
    };
    const inTree = new Set([t.top, ...t.parents.keys()]);
    for (const id of inTree) {
      const node = nodes.get(id);
      if (!node) continue;
      node.rollup ??= {};
      node.rollup[tree] = summarize([...collect(id).values()]);
    }
  }

  // ── 6. Links ──────────────────────────────────────────────────────
  const labels = new Map(); // normalized label → id
  for (const node of nodes.values()) labels.set(node.id, node.id);
  for (const node of nodes.values()) {
    for (const alias of node.aliases) {
      const key = normalizeLabel(alias);
      if (!labels.has(key)) labels.set(key, node.id);
    }
  }
  const mermaidIds = (body) => {
    const stripped = body
      .replace(/%%.*$/gm, '')
      .replace(/"[^"]*"/g, ' ')
      .replace(/(--|==|-\.)\s[^\n]*?\s(-->|---|==>|\.->)/g, ' --> ')
      .replace(/\|[^|]*\|/g, ' ')
      .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, ' ');
    const found = [];
    for (const word of stripped.match(/[A-Za-z0-9][A-Za-z0-9_-]*/g) ?? []) {
      const id = word.toLowerCase().replace(/_/g, '-');
      if (nodes.has(id) && !nodes.get(id).virtual && !found.includes(id)) found.push(id);
    }
    return found;
  };

  for (const node of nodes.values()) {
    node.links = [];
    const doc = node.doc;
    if (!doc) continue;
    const add = (id) => { if (id !== node.id && !node.links.includes(id)) node.links.push(id); };
    for (const ref of doc.refsUsed) {
      const id = labels.get(ref.label);
      if (id) add(id);
      else if (ref.kind !== 'shortcut' && !doc.refDefs.has(ref.label)) {
        report('broken-ref', doc.file, ref.line, `reference "[${ref.raw}]" is not a node id or alias`);
      }
    }
    for (const block of doc.mermaid) {
      block.ids = mermaidIds(block.body);
      block.ids.forEach(add);
    }
  }

  // Relative links in every scanned file, node or not.
  for (const doc of parsed) {
    const owner = byFile.get(doc.file);
    const targets = [...doc.links.map((l) => ({ ...l })), ...[...doc.refDefs.values()]];
    for (const link of targets) {
      if (!link.target || isExternal(link.target)) continue;
      let target = link.target.split('#')[0].split('?')[0];
      try { target = decodeURIComponent(target); } catch { /* keep as is */ }
      const rel = target.startsWith('/')
        ? target.slice(1)
        : path.posix.normalize(path.posix.join(path.posix.dirname(doc.file), target));
      if (!exists(rel)) {
        report('broken-link', doc.file, link.line, `link target "${link.target}" does not exist`);
      } else if (owner) {
        const linked = byFile.get(rel) ?? byFile.get(path.posix.join(rel, 'README.md'));
        if (linked && linked.id !== owner.id && !owner.links.includes(linked.id)) owner.links.push(linked.id);
      }
    }
  }

  // ── 7. Other checks ───────────────────────────────────────────────
  const maxWords = ruleSetting(config.rules['summary-max-words']).option ?? 25;
  for (const node of nodes.values()) {
    if (node.virtual) continue;
    for (const codePath of node.code) {
      if (!exists(codePath.replace(/\/$/, ''))) {
        report('missing-code', node.file, node.line, `code path "${codePath}" does not exist`);
      }
    }
    if (node.summary) {
      for (const sentence of node.summary.split(/(?<=[.!?])\s+/)) {
        const words = sentence.split(/\s+/).filter(Boolean).length;
        if (words > maxWords) {
          report('summary-max-words', node.file, node.line,
            `summary sentence has ${words} words (max ${maxWords}): "${sentence.slice(0, 60)}…"`);
        }
      }
    }
    const r = node.rollup?.[primary];
    if (node.kind === 'plan' && r && r.open === 0 && (r.done + r.states.deferred + r.states.dropped) > 0) {
      report('plan-finished', node.file, node.line, `plan "${node.id}" has no open tasks; move its facts to their home pages and delete it`);
    }
    const hasChildrenBlock = node.doc?.generated.some((g) => g.name === 'children');
    if (!hasChildrenBlock) {
      for (const kid of pt.children.get(node.id) ?? []) {
        if (nodes.get(kid)?.virtual || node.links.includes(kid)) continue;
        report('unlinked-child', node.file, node.line, `page does not link to its child "${kid}"`);
      }
    }
  }

  return { nodes, trees, rootId, primary, byFile, labels, problems };
}

function leafDescendants(tasks, task) {
  if (!task.children.length) return [task];
  return task.children.flatMap((i) => leafDescendants(tasks, tasks[i]));
}

function sortSiblings(ids, nodes) {
  return [...ids].sort((a, b) => {
    const na = nodes.get(a);
    const nb = nodes.get(b);
    const oa = na?.order ?? Infinity;
    const ob = nb?.order ?? Infinity;
    if (oa !== ob) return oa - ob;
    return (na?.title ?? a).localeCompare(nb?.title ?? b);
  });
}

function parsePath(raw) {
  if (typeof raw !== 'string') return null;
  const parts = raw.split('.').map((s) => s.trim());
  return parts.every((p) => ID_PATTERN.test(p)) ? parts : null;
}

function nodeFromFrontmatter(doc, data, rootConfig, report, treeNames, primary) {
  const fmLine = 0;
  const bad = (msg) => report('frontmatter', doc.file, fmLine, msg);
  const id = data.id ?? rootConfig?.id;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    bad(`id ${JSON.stringify(id)} must be lowercase letters, digits, and single hyphens`);
    return null;
  }
  const title = data.title ?? (rootConfig ? doc.firstHeading?.text : undefined);
  if (typeof title !== 'string' || !title.trim()) bad('title is required');
  if (!rootConfig && (typeof data.summary !== 'string' || !data.summary.trim())) bad('summary is required');
  if (data.kind != null && !KINDS.includes(data.kind)) bad(`kind "${data.kind}" is not one of ${KINDS.join(', ')}`);
  if (data.status != null && !STATES.includes(data.status)) bad(`status "${data.status}" is not one of ${STATES.join(', ')}`);
  if (data.order != null && typeof data.order !== 'number') bad('order must be a number');

  const declared = {};
  const addRef = (tree, raw) => {
    const p = parsePath(raw);
    if (!p) { bad(`parent "${raw}" (${tree}) is not a valid id or dot-separated path`); return; }
    (declared[tree] ??= []).push({ raw, path: p });
  };
  if (data.parent != null) addRef(primary, data.parent);
  if (data.parents != null) {
    if (typeof data.parents !== 'object' || Array.isArray(data.parents)) bad('parents must be a map from tree name to parent');
    else {
      for (const [tree, value] of Object.entries(data.parents)) {
        if (!treeNames.includes(tree)) {
          report('unknown-tree', doc.file, fmLine, `tree "${tree}" is not in the configuration`);
          continue;
        }
        const values = Array.isArray(value) ? value : [value];
        if (tree === primary) {
          if (data.parent != null && (values.length !== 1 || values[0] !== data.parent)) {
            bad(`parent and parents.${primary} disagree`);
            continue;
          }
          if (data.parent != null) continue;
          if (values.length !== 1) { bad(`a node has exactly one parent in the primary tree (${primary})`); continue; }
        }
        values.forEach((v) => addRef(tree, v));
      }
    }
  }

  const toList = (v, field) => {
    if (v == null) return [];
    if (typeof v === 'string') return [v];
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v;
    bad(`${field} must be a string or a list of strings`);
    return [];
  };

  const code = toList(data.code, 'code');
  return {
    id,
    title: typeof title === 'string' ? title : id,
    summary: typeof data.summary === 'string' ? data.summary.trim() : null,
    kind: KINDS.includes(data.kind) ? data.kind : (code.length ? 'module' : 'reference'),
    file: doc.file,
    virtual: false,
    status: STATES.includes(data.status) ? data.status : null,
    code,
    aliases: toList(data.aliases, 'aliases'),
    order: typeof data.order === 'number' ? data.order : null,
    declared,
    doc,
    line: fmLine,
  };
}

/** The file a link to this id should point to. */
export function linkTarget(model, id) {
  const { nodes, trees, primary, rootId } = model;
  const seen = new Set();
  for (let cur = id; cur && !seen.has(cur); cur = trees[primary].parents.get(cur)?.[0]) {
    seen.add(cur);
    if (nodes.get(cur)?.file) return nodes.get(cur).file;
  }
  return nodes.get(rootId)?.file ?? null;
}

/** The model as plain JSON (SPEC.md section 12). */
export function toJSON(model) {
  const { nodes, trees, rootId, primary, problems } = model;
  const treeNames = Object.keys(trees);
  const out = {
    version: '0.1',
    root: rootId,
    primaryTree: primary,
    trees: Object.fromEntries(treeNames.map((t) => [t, { title: trees[t].title, top: trees[t].top }])),
    nodes: {},
    problems,
  };
  for (const node of nodes.values()) {
    out.nodes[node.id] = {
      id: node.id,
      title: node.title,
      summary: node.summary,
      kind: node.kind,
      file: node.file,
      virtual: node.virtual,
      status: node.status,
      code: node.code,
      aliases: node.aliases,
      parents: Object.fromEntries(treeNames.map((t) => [t, trees[t].parents.get(node.id) ?? []])),
      children: Object.fromEntries(treeNames.map((t) => [t, trees[t].children.get(node.id) ?? []])),
      tasks: node.tasks,
      rollup: node.rollup ?? {},
      links: node.links ?? [],
    };
  }
  return out;
}

import path from 'node:path';
import { normalizeLabel } from './parse.js';
import { STATE_MARKS } from './parse.js';
import { aggregateState, linkTarget } from './model.js';

const startMarker = (name) => `<!-- idk-plans:${name}:start (generated) -->`;
const endMarker = (name) => `<!-- idk-plans:${name}:end -->`;

/** Progress as text (SPEC.md 5.6). Empty when there are no tasks at all. */
export function rollupText(r) {
  if (!r) return '';
  const { scope, done, percent, states } = r;
  if (scope + states.deferred + states.dropped === 0) return '';
  let text;
  if (scope === 0) text = '· no tasks';
  else if (done === scope) text = `● 100% (${done}/${scope})`;
  else if (done === 0) text = `○ 0% (0/${scope})`;
  else text = `◐ ${percent}% (${done}/${scope})`;
  if (states.blocked) text += ` · ${states.blocked} blocked`;
  if (states.deferred) text += ` · ${states.deferred} deferred`;
  if (states.dropped) text += ` · ${states.dropped} dropped`;
  return text;
}

/** An inline link to a node, with the node id as the link title (SPEC.md 6.4). */
export function nodeLink(model, fromFile, id, text, anchor = '') {
  const target = linkTarget(model, id);
  if (!target) return text;
  return `[${text}](${relLink(fromFile, target, anchor)} "${id}")`;
}

function linkFor(model, fromFile, node) {
  return node.virtual ? node.title : nodeLink(model, fromFile, node.id, node.title);
}

function withBadge(text, r) {
  const badge = rollupText(r);
  return badge ? `${text} ${badge}` : text;
}

function renderChildren(model, id, fromFile) {
  const { nodes, trees, primary } = model;
  const out = [];
  const walk = (parentId, depth, seen) => {
    for (const kid of trees[primary].children.get(parentId) ?? []) {
      if (seen.has(kid)) continue;
      const node = nodes.get(kid);
      const pad = '  '.repeat(depth);
      const summary = node.summary ? `: ${node.summary}` : '';
      out.push(`${pad}- ${linkFor(model, fromFile, node)}${summary}${rollupText(node.rollup?.[primary]) ? ` ${rollupText(node.rollup[primary])}` : ''}`);
      if (node.virtual) walk(kid, depth + 1, new Set([...seen, kid]));
    }
  };
  walk(id, 0, new Set([id]));
  return out.length ? out : ['_No children yet._'];
}

function renderTrees(model, fromFile) {
  const { nodes, trees, primary } = model;
  const out = [];
  for (const [name, tree] of Object.entries(trees)) {
    if (name === primary) continue;
    const top = nodes.get(tree.top);
    if (out.length) out.push('');
    out.push(withBadge(`**${tree.title}**`, top?.rollup?.[name]));
    out.push('');
    const walk = (id, depth, seen) => {
      for (const kid of tree.children.get(id) ?? []) {
        if (seen.has(kid)) continue;
        const node = nodes.get(kid);
        out.push(`${'  '.repeat(depth)}- ${withBadge(linkFor(model, fromFile, node), node.rollup?.[name])}`);
        walk(kid, depth + 1, new Set([...seen, kid]));
      }
    };
    walk(tree.top, 0, new Set([tree.top]));
    if (out.at(-1) === '') out.push('_Nothing in this tree yet._');
  }
  return out.length ? out : ['_There are no other trees._'];
}

function renderZoom(model, selfId, ids, fromFile) {
  const items = ids.filter((id) => id !== selfId).map((id) => linkFor(model, fromFile, model.nodes.get(id)));
  return items.length ? [`Zoom in: ${items.join(' · ')}`] : null;
}

function relLink(fromFile, toFile, anchor = '') {
  let rel = path.posix.relative(path.posix.dirname(fromFile), toFile) || path.posix.basename(toFile);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  rel += anchor;
  return /[\s()<>]/.test(rel) ? `<${rel}>` : rel;
}

function block(name, content) {
  return [startMarker(name), ...content, endMarker(name)];
}

/**
 * Compute the corrected text of one node file.
 * options.blocks: regenerate generated content (blocks, links, aliases, tags)
 * options.marks: correct task marks from their subtasks
 */
export function fixDocument(model, node, options = { blocks: true, marks: true }) {
  const doc = node.doc;
  const lines = [...doc.lines];
  const { primary, labels, nodes } = model;

  if (options.marks) {
    for (const task of doc.tasks) {
      if (!task.children.length) continue;
      const leaves = [];
      const collect = (t) => (t.children.length ? t.children.forEach((i) => collect(doc.tasks[i])) : leaves.push(t.markState));
      collect(task);
      const expected = aggregateState(leaves);
      if (expected !== task.markState) {
        lines[task.line] = lines[task.line].replace(`[${task.mark}]`, `[${STATE_MARKS[expected]}]`);
      }
    }
  }

  if (!options.blocks) return lines.join('\n');

  rewriteLinks(model, node, lines);

  // Edits as { start, end (inclusive, or start-1 for insert), lines }.
  const edits = [];
  const existing = new Map();
  for (const g of doc.generated) {
    if (!existing.has(g.name)) existing.set(g.name, []);
    existing.get(g.name).push(g);
  }

  const replaceOrDrop = (g, content) => {
    edits.push({ start: g.start, end: g.end, lines: content ? block(g.name, content) : [] });
  };

  const r = node.rollup?.[primary];
  const progress = rollupText(r);
  for (const g of existing.get('progress') ?? []) replaceOrDrop(g, progress ? [progress] : ['_No tasks yet._']);
  if (!existing.has('progress') && progress && !doc.progressOff && doc.firstHeading) {
    const at = doc.firstHeading.line;
    edits.push({ start: at + 1, end: at, lines: ['', ...block('progress', [progress])] });
  }

  for (const g of existing.get('children') ?? []) replaceOrDrop(g, renderChildren(model, node.id, node.file));
  for (const g of existing.get('trees') ?? []) replaceOrDrop(g, renderTrees(model, node.file));

  // Zoom blocks belong to the Mermaid block directly above them.
  const zooms = [...(existing.get('zoom') ?? [])];
  for (const m of doc.mermaid) {
    let next = m.end + 1;
    while (next < lines.length && !lines[next].trim()) next++;
    const zi = zooms.findIndex((z) => z.start === next);
    const content = renderZoom(model, node.id, m.ids ?? [], node.file);
    if (zi !== -1) {
      replaceOrDrop(zooms[zi], content);
      zooms.splice(zi, 1);
    } else if (content) {
      edits.push({ start: m.end + 1, end: m.end, lines: ['', ...block('zoom', content)] });
    }
  }
  for (const z of zooms) replaceOrDrop(z, null);

  // Apply edits from the bottom up, so earlier line numbers stay valid.
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  for (const e of edits) lines.splice(e.start, e.end - e.start + 1, ...e.lines);
  // Last, because it can change the number of frontmatter lines.
  ensureTitleAlias(node, lines);
  if (model.config?.tags !== false) ensureTreeTags(model, node, lines);

  // Links are inline now; remove reference blocks from older versions.
  const text = stripBlock(lines.join('\n'), 'refs').replace(/\s*$/, '');
  return `${text}\n`;
}

/**
 * Turn id references into inline links, and correct the path of every link
 * whose title is an id or alias. Does not change the number of lines.
 */
function rewriteLinks(model, node, lines) {
  const doc = node.doc;
  const byLine = new Map();
  const add = (line, start, end, text) => {
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line).push({ start, end, text });
  };
  for (const ref of doc.refsUsed) {
    const id = model.labels.get(ref.label);
    if (!id || doc.refDefs.has(ref.label)) continue;
    let text = ref.text;
    if (ref.kind !== 'full' && ref.label === id) text = model.nodes.get(id).title;
    add(ref.line, ref.start, ref.end, nodeLink(model, node.file, id, text));
  }
  for (const link of doc.links) {
    if (link.image || link.title == null) continue;
    const id = model.labels.get(normalizeLabel(link.title));
    if (!id) continue;
    const hash = link.target.indexOf('#');
    const anchor = hash === -1 ? '' : link.target.slice(hash);
    const fixed = nodeLink(model, node.file, id, link.text, anchor);
    if (lines[link.line].slice(link.start, link.end) !== fixed) add(link.line, link.start, link.end, fixed);
  }
  for (const [line, edits] of byLine) {
    edits.sort((a, b) => b.start - a.start);
    for (const e of edits) lines[line] = lines[line].slice(0, e.start) + e.text + lines[line].slice(e.end);
  }
}

/**
 * Add the title to the frontmatter aliases, so that tools that show file names
 * (such as Obsidian, where many pages are README.md) can find the page by title.
 */
function ensureTitleAlias(node, lines) {
  const fm = node.doc.frontmatter;
  if (!fm?.data || fm.error || !node.title) return;
  const title = normalizeLabel(node.title);
  if (title === node.id || node.aliases.some((a) => normalizeLabel(a) === title)) return;

  // Edit only the aliases lines, so the rest of the frontmatter keeps its formatting.
  const value = /^[\w .()/-]+$/.test(node.title) && !/^\s|\s$/.test(node.title)
    ? node.title
    : JSON.stringify(node.title);
  const at = lines.findIndex((l, i) => i > 0 && i < fm.end && /^aliases:/.test(l));
  if (at === -1) {
    lines.splice(fm.end, 0, `aliases: [${value}]`);
    return;
  }
  const rest = lines[at].slice('aliases:'.length).trim();
  const flow = rest.match(/^\[(.*)\]\s*(#.*)?$/);
  if (flow) {
    const items = flow[1].trim();
    lines[at] = `aliases: [${items ? `${items}, ` : ''}${value}]${flow[2] ? ` ${flow[2]}` : ''}`;
  } else if (rest && !rest.startsWith('#')) {
    lines[at] = `aliases: [${rest}, ${value}]`;
  } else {
    let last = at;
    while (last + 1 < fm.end && /^\s*-\s/.test(lines[last + 1])) last++;
    const indent = lines[last].match(/^\s*/)[0] || '  ';
    lines.splice(last + 1, 0, `${indent}- ${value}`);
  }
}

/**
 * Each place of a node in each tree, as a nested tag: <tree>/<id>/.../<node id>.
 * The primary tree comes first. Tree tops are not part of the path.
 */
export function treeTags(model, id) {
  const { trees, primary } = model;
  const names = [primary, ...Object.keys(trees).filter((t) => t !== primary)];
  const tags = [];
  for (const name of names) {
    const tree = trees[name];
    const paths = (cur, seen) => {
      if (cur === tree.top) return [[]];
      if (seen.has(cur)) return [];
      const ps = tree.parents.get(cur) ?? [];
      return ps.flatMap((p) => paths(p, new Set([...seen, cur])).map((path) => [...path, cur]));
    };
    for (const path of paths(id, new Set())) {
      if (path.length) tags.push([name, ...path].join('/'));
    }
  }
  return [...new Set(tags)];
}

/** Write the tree tags into the frontmatter `tags`, keeping tags that the tool does not own. */
function ensureTreeTags(model, node, lines) {
  const fm = node.doc.frontmatter;
  if (!fm?.data || fm.error) return;
  const treeNames = Object.keys(model.trees);
  let existing = fm.data.tags ?? [];
  if (typeof existing === 'string') existing = existing.split(/[\s,]+/).filter(Boolean);
  if (!Array.isArray(existing)) return;
  existing = existing.map((t) => String(t).replace(/^#/, ''));
  const own = (t) => treeNames.includes(t.split('/')[0]);
  const desired = [...treeTags(model, node.id), ...existing.filter((t) => !own(t))];
  if (desired.join('\n') === existing.join('\n')) return;

  const end = lines.findIndex((l, i) => i > 0 && (l.trim() === '---' || l.trim() === '...'));
  const at = lines.findIndex((l, i) => i > 0 && i < end && /^tags:/.test(l));
  if (at === -1) {
    if (desired.length) lines.splice(end, 0, `tags: [${desired.join(', ')}]`);
    return;
  }
  let last = at;
  const block = !lines[at].slice('tags:'.length).trim();
  if (block) while (last + 1 < end && /^\s*-\s/.test(lines[last + 1])) last++;
  const indent = block && last > at ? lines[at + 1].match(/^\s*/)[0] : '  ';
  const replacement = !desired.length ? []
    : block ? ['tags:', ...desired.map((t) => `${indent}- ${t}`)]
    : [`tags: [${desired.join(', ')}]`];
  lines.splice(at, last - at + 1, ...replacement);
}

function stripBlock(text, name) {
  const re = new RegExp(`\\n*<!--\\s*idk-plans:${name}:start\\b[\\s\\S]*?<!--\\s*idk-plans:${name}:end\\s*-->`, 'g');
  return text.replace(re, '');
}

/** First line (1-based) where two texts differ. */
export function firstDifference(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) return i + 1;
  }
  return null;
}

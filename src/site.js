import { existsSync } from 'node:fs';
import { mkdir, writeFile, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { normalizeLabel } from './parse.js';
import { rollupText } from './fix.js';
import { titleFromId } from './model.js';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site-assets');
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';
const TASK_SENTINEL = /([a-z]+)/g;

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Show #blocked as a tag, except inside code. */
function tagBlocked(html) {
  return html.split(/(<pre[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>)/).map((part, i) => (
    i % 2 ? part : part.replace(/(^|[\s>(])#blocked\b/g, '$1<span class="tag blocked">#blocked</span>')
  )).join('');
}

/** Site path of a node page, relative to the site root. The root is index.html. */
function pagePath(model, id) {
  return id === model.rootId ? 'index.html' : `${id}/index.html`;
}

/** A link from one page to another page or asset. All links are relative. */
function href(fromPage, toPage) {
  const rel = path.posix.relative(path.posix.dirname(fromPage), toPage) || path.posix.basename(toPage);
  return rel.replace(/(^|\/)index\.html$/, '$1') || './';
}

/** Ids, from the top down, of the first path to a node in a tree. */
function trail(model, tree, id) {
  const t = model.trees[tree];
  const out = [];
  const seen = new Set();
  for (let cur = id; cur && !seen.has(cur); cur = t.parents.get(cur)?.[0]) {
    seen.add(cur);
    out.unshift(cur);
    if (cur === t.top) break;
  }
  return out[0] === t.top ? out : null;
}

function inTree(model, tree, id) {
  const t = model.trees[tree];
  return id === t.top || t.parents.has(id);
}

function progressBar(r) {
  if (!r || r.scope + r.states.deferred + r.states.dropped === 0) return '';
  const pct = (n) => (r.scope ? (100 * n) / r.scope : 0);
  const seg = (cls, n) => (n ? `<span class="seg ${cls}" style="width:${pct(n).toFixed(2)}%"></span>` : '');
  return `<div class="progress" title="${esc(rollupText(r))}">
  <div class="bar">${seg('done', r.done)}${seg('doing', r.states.doing)}${seg('blocked', r.states.blocked)}</div>
  <span class="progress-text">${esc(rollupText(r))}</span>
</div>`;
}

/**
 * The project's own Mermaid browser build, or null if the project does not install `mermaid`.
 * Looks in node_modules from cwd upward, as Node does.
 */
export function findLocalMermaid(cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
    if (existsSync(file)) return file;
    if (path.dirname(dir) === dir) return null;
  }
}

/** Build the whole site into outDir. Returns the list of written pages. */
export async function buildSite(project, outDir, options = {}) {
  const { model, cwd, config } = project;
  const siteConfig = { ...(config.site ?? {}), ...options };
  const sourceUrl = siteConfig.sourceUrl?.replace(/\/$/, '') ?? null;
  const siteTitle = siteConfig.title ?? model.nodes.get(model.rootId)?.title ?? 'Architecture';
  const treeOrder = [model.primary, ...Object.keys(model.trees).filter((t) => t !== model.primary)];

  // Backlinks.
  const backlinks = new Map();
  for (const node of model.nodes.values()) {
    for (const target of node.links ?? []) {
      if (!backlinks.has(target)) backlinks.set(target, []);
      backlinks.get(target).push(node.id);
    }
  }

  // "local" copies the project's Mermaid, so diagrams work offline. It is a
  // classic script, not a module, because browsers block modules on file:// pages.
  const mermaidMode = siteConfig.mermaid ?? 'cdn';
  if (!['cdn', 'local'].includes(mermaidMode)) throw new Error(`site.mermaid must be "cdn" or "local"`);
  const localMermaid = mermaidMode === 'local' ? findLocalMermaid(cwd ?? '.') : null;
  if (mermaidMode === 'local' && !localMermaid) {
    throw new Error('site.mermaid is "local", but the mermaid package is not installed; run `npm install --save-dev mermaid`');
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, 'assets'), { recursive: true });
  for (const asset of ['site.css', 'site.js']) {
    await copyFile(path.join(ASSETS, asset), path.join(outDir, 'assets', asset));
  }
  if (localMermaid) await copyFile(localMermaid, path.join(outDir, 'assets', 'mermaid.min.js'));

  // Search index, as a script so that the site also works from file://.
  const index = [...model.nodes.values()].map((n) => ({
    id: n.id,
    title: n.title,
    summary: n.summary ?? '',
    aliases: n.aliases,
    kind: n.kind,
    url: pagePath(model, n.id),
  }));
  await writeFile(path.join(outDir, 'assets', 'search-index.js'),
    `window.IDK_INDEX = ${JSON.stringify(index)};\n`);

  const nodeLink = (fromPage, id, text) => {
    const n = model.nodes.get(id);
    return `<a href="${esc(href(fromPage, pagePath(model, id)))}">${text ?? esc(n?.title ?? id)}</a>`;
  };

  // ── Markdown rendering ────────────────────────────────────────────
  // Generated blocks: the site draws `children` and `trees` itself, in the same
  // place; it drops `progress` and `zoom` (the page header and the diagram links
  // replace them).
  const renderBody = (node, fromPage, blocks) => {
    const doc = node.doc;
    const drop = new Set();
    for (let i = 0; i < doc.bodyStart; i++) drop.add(i);
    if (doc.firstHeading?.level === 1) drop.add(doc.firstHeading.line);
    const lines = doc.lines.map((l) => l);
    for (const g of doc.generated) {
      for (let i = g.start; i <= g.end; i++) drop.add(i);
      if (blocks[g.name]) {
        drop.delete(g.start);
        lines[g.start] = `\uE002${g.name}\uE003`;
      }
    }
    for (const task of doc.tasks) {
      lines[task.line] = lines[task.line].replace(`[${task.mark}]`, `${task.state}`);
    }

    const md = new Marked({ gfm: true });
    md.use({
      renderer: {
        // Callouts (`> [!note]- Title`) are the second form of a collapsible section.
        blockquote(token) {
          const m = token.text.match(/^\[!([\w-]+)\]([+-]?)[ \t]*(.*)(?:\n|$)/);
          if (!m) return false;
          const [head, type, fold, title] = m;
          const label = title ? md.parseInline(title) : esc(titleFromId(type.toLowerCase()));
          const body = md.parse(token.text.slice(head.length));
          const attrs = `class="callout" data-callout="${esc(type.toLowerCase())}"`;
          if (!fold) return `<div ${attrs}><p class="callout-title">${label}</p>\n${body}</div>\n`;
          return `<details ${attrs}${fold === '+' ? ' open' : ''}><summary>${label}</summary>\n${body}</details>\n`;
        },
        link(token) {
          const text = this.parser.parseInline(token.tokens);
          const t = token.title != null ? model.labels.get(normalizeLabel(token.title)) : null;
          if (t) return nodeLink(fromPage, t, text);
          const target = token.href;
          if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) {
            return `<a href="${esc(target)}">${text}</a>`;
          }
          const [p, anchor = ''] = target.split('#');
          let rel;
          try { rel = path.posix.normalize(path.posix.join(path.posix.dirname(node.file), decodeURIComponent(p))); } catch { rel = p; }
          const linked = model.byFile.get(rel) ?? model.byFile.get(path.posix.join(rel, 'README.md'));
          if (linked) return nodeLink(fromPage, linked.id, text);
          if (sourceUrl) return `<a class="source" href="${esc(`${sourceUrl}/${rel}${anchor ? `#${anchor}` : ''}`)}">${text}</a>`;
          return `<span class="source">${text}</span>`;
        },
        code(token) {
          if (token.lang === 'mermaid') {
            const map = {};
            const words = token.text.replace(/"[^"]*"|\|[^|]*\||\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, ' ')
              .match(/[A-Za-z0-9][A-Za-z0-9_-]*/g) ?? [];
            for (const w of words) {
              const id = w.toLowerCase().replace(/_/g, '-');
              const n = model.nodes.get(id);
              if (n && !n.virtual && id !== node.id) map[w] = href(fromPage, pagePath(model, id));
            }
            return `<pre class="mermaid" data-links="${esc(JSON.stringify(map))}">${esc(token.text)}</pre>\n`;
          }
          return false;
        },
      },
    });

    let html = md.parse(lines.filter((_, i) => !drop.has(i)).join('\n'));
    html = html.replace(/(?:<p>)?\uE002([a-z-]+)\uE003(?:<\/p>)?/g, (_, name) => blocks[name]());
    html = html.replace(TASK_SENTINEL, (_, state) => `<span class="task-mark" data-state="${state}" title="${state}"></span>`);
    return tagBlocked(html);
  };

  // ── Page parts ────────────────────────────────────────────────────
  const sidebarTree = (fromPage, tree, currentId) => {
    const t = model.trees[tree];
    const open = new Set(inTree(model, tree, currentId) ? trail(model, tree, currentId) ?? [] : []);
    const item = (id, seen) => {
      const n = model.nodes.get(id);
      const kids = (t.children.get(id) ?? []).filter((k) => !seen.has(k));
      const label = `${id === currentId ? '<strong>' : ''}${esc(n.title)}${id === currentId ? '</strong>' : ''}`;
      const link = `<a href="${esc(href(fromPage, pagePath(model, id)))}"${id === currentId ? ' aria-current="page"' : ''}>${label}</a>${badgeDot(n.rollup?.[tree])}`;
      if (!kids.length) return `<li>${link}</li>`;
      const inner = kids.map((k) => item(k, new Set([...seen, k]))).join('');
      return `<li><details${open.has(id) || id === t.top ? ' open' : ''}><summary>${link}</summary><ul>${inner}</ul></details></li>`;
    };
    return `<ul class="tree">${item(t.top, new Set([t.top]))}</ul>`;
  };

  const badgeDot = (r) => {
    if (!r || !r.scope) return '';
    const cls = r.done === r.scope ? 'done' : r.done === 0 ? 'todo' : 'partial';
    return ` <span class="dot ${cls}" title="${esc(rollupText(r))}"></span>`;
  };

  const layout = ({ page, title, currentId, main }) => {
    const root = (p) => href(page, p);
    const selected = treeOrder.find((t) => currentId && inTree(model, t, currentId)) ?? treeOrder[0];
    const tabs = treeOrder.map((tree) => `<button type="button" role="tab" data-tree="${esc(tree)}" aria-selected="${tree === selected}">${esc(model.trees[tree].title)}</button>`).join('');
    const panels = treeOrder.map((tree) => `<div class="tree-panel" data-tree="${esc(tree)}"${tree === selected ? '' : ' hidden'}>${sidebarTree(page, tree, currentId)}</div>`).join('');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(siteTitle)}</title>
<link rel="stylesheet" href="${root('assets/site.css')}">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <button type="button" class="menu" aria-label="Show navigation" aria-expanded="false">☰</button>
  <a class="site-title" href="${root('index.html')}">${esc(siteTitle)}</a>
  <nav class="top-links"><a href="${root('tasks.html')}">Tasks</a><a href="${root('glossary.html')}">Glossary</a></nav>
  <div class="search"><input type="search" placeholder="Search pages" aria-label="Search pages"><ul class="results" hidden></ul></div>
</header>
<div class="shell">
<nav class="sidebar" aria-label="Site map">
  <div class="tabs" role="tablist">${tabs}</div>
  ${panels}
</nav>
<main id="main">
${main}
</main>
</div>
<script>window.IDK_ROOT = ${JSON.stringify(root('index.html').replace(/index\.html$|\.\/$/, '') || './')};</script>
<script src="${root('assets/search-index.js')}"></script>
<script src="${root('assets/site.js')}"></script>
<script type="module">
  const blocks = document.querySelectorAll('pre.mermaid');
  if (blocks.length) {
    const mermaid = ${localMermaid
    ? `await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = ${JSON.stringify(root('assets/mermaid.min.js'))};
      s.onload = () => resolve(window.mermaid);
      s.onerror = reject;
      document.head.append(s);
    })`
    : `(await import('${MERMAID_URL}')).default`};
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', securityLevel: 'strict' });
    await mermaid.run({ nodes: blocks });
    window.idkLinkDiagrams?.();
  }
</script>
</body>
</html>
`;
  };

  const crumbs = (page, tree, id) => {
    const ids = trail(model, tree, id);
    if (!ids || ids.length < 2) return '';
    return `<nav class="crumbs" aria-label="${esc(model.trees[tree].title)} path">${ids.slice(0, -1)
      .map((c) => nodeLink(page, c)).join('<span aria-hidden="true">›</span>')}</nav>`;
  };

  // Every tree except the primary one, as nested lists (for a `trees` block).
  const treeOverview = (page) => treeOrder.slice(1).map((tree) => {
    const t = model.trees[tree];
    const list = (id, seen) => {
      const kids = (t.children.get(id) ?? []).filter((k) => !seen.has(k));
      if (!kids.length) return '';
      return `<ul>${kids.map((k) => {
        const n = model.nodes.get(k);
        return `<li>${nodeLink(page, k)}${badgeDot(n.rollup?.[tree])}${list(k, new Set([...seen, k]))}</li>`;
      }).join('')}</ul>`;
    };
    return `<div class="view"><h3>${nodeLink(page, t.top, esc(t.title))}</h3>${progressBar(model.nodes.get(t.top)?.rollup?.[tree])}<div class="tree-overview">${list(t.top, new Set([t.top]))}</div></div>`;
  }).join('');

  const card = (page, id, tree) => {
    const n = model.nodes.get(id);
    return `<li class="card"><a href="${esc(href(page, pagePath(model, id)))}"><span class="card-title">${esc(n.title)}</span>${n.virtual ? '<span class="kind">group</span>' : n.kind ? `<span class="kind">${esc(n.kind)}</span>` : ''}</a>
  ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}${progressBar(n.rollup?.[tree])}</li>`;
  };

  const written = [];
  const write = async (page, html) => {
    const file = path.join(outDir, page);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html);
    written.push(page);
  };

  // ── Node pages ────────────────────────────────────────────────────
  for (const node of model.nodes.values()) {
    const page = pagePath(model, node.id);
    const primaryKids = model.trees[model.primary].children.get(node.id) ?? [];
    const otherTrees = treeOrder.slice(1).filter((t) => inTree(model, t, node.id));
    const homeTree = inTree(model, model.primary, node.id) ? model.primary : otherTrees[0] ?? model.primary;

    let main = '';
    main += crumbs(page, homeTree, node.id);
    main += `<h1>${esc(node.title)}</h1>`;
    const meta = [node.virtual ? 'group' : node.kind, node.status ? `status: ${node.status}` : null].filter(Boolean);
    if (meta.length) main += `<p class="meta">${meta.map(esc).join(' · ')}</p>`;
    main += progressBar(node.rollup?.[homeTree]);
    if (node.summary) main += `<p class="lead">${esc(node.summary)}</p>`;
    const kids = homeTree === model.primary ? primaryKids : model.trees[homeTree].children.get(node.id) ?? [];
    const childCards = () => `<ul class="cards">${kids.map((k) => card(page, k, homeTree)).join('')}</ul>`;
    let placedChildren = false;
    if (node.doc) {
      const blocks = {
        children: () => { placedChildren = true; return kids.length ? childCards() : ''; },
        trees: () => treeOverview(page),
      };
      main += `<article class="body">${renderBody(node, page, blocks)}</article>`;
    }
    if (kids.length && !placedChildren) {
      main += `<section><h2>Parts</h2>${childCards()}</section>`;
    }

    const places = otherTrees.filter((t) => t !== homeTree);
    if (places.length) {
      main += '<section><h2>In other views</h2>';
      for (const t of places) {
        const tKids = model.trees[t].children.get(node.id) ?? [];
        main += `<div class="view"><h3>${esc(model.trees[t].title)}</h3>${crumbs(page, t, node.id) || '<p class="meta">Top level</p>'}${progressBar(node.rollup?.[t])}`;
        if (tKids.length) main += `<ul class="cards">${tKids.map((k) => card(page, k, t)).join('')}</ul>`;
        main += '</div>';
      }
      main += '</section>';
    }

    const back = (backlinks.get(node.id) ?? []).filter((b) => model.nodes.has(b));
    if (back.length) {
      main += `<section><h2>Linked from</h2><ul class="links">${back.map((b) => `<li>${nodeLink(page, b)}</li>`).join('')}</ul></section>`;
    }

    if (node.file) {
      const src = sourceUrl ? `<a href="${esc(`${sourceUrl}/${node.file}`)}">${esc(node.file)}</a>` : esc(node.file);
      main += `<footer class="page-footer">Source: ${src}${node.code.length ? ` · Code: ${node.code.map((c) => (sourceUrl ? `<a href="${esc(`${sourceUrl}/${c}`)}">${esc(c)}</a>` : esc(c))).join(', ')}` : ''}</footer>`;
    }

    await write(page, layout({ page, title: node.title, currentId: node.id, main }));
  }

  // ── Tasks page ────────────────────────────────────────────────────
  {
    const page = 'tasks.html';
    const groups = { blocked: [], doing: [], todo: [] };
    for (const id of orderedIds(model)) {
      const n = model.nodes.get(id);
      for (const task of n.tasks ?? []) {
        if (groups[task.state] && !task.implicit) groups[task.state].push({ id, task });
      }
    }
    const titles = { blocked: 'Blocked', doing: 'In progress', todo: 'To do' };
    let main = `<h1>Tasks</h1>${progressBar(model.nodes.get(model.rootId)?.rollup?.[model.primary])}<p class="lead">Every open task, grouped by state and then by page. Deferred and dropped tasks are on their pages.</p>`;
    for (const state of ['blocked', 'doing', 'todo']) {
      const items = groups[state];
      main += `<section><h2>${titles[state]} <span class="count">${items.length}</span></h2>`;
      if (!items.length) { main += '<p class="meta">None.</p></section>'; continue; }
      let current = null;
      for (const { id, task } of items) {
        if (id !== current) {
          if (current) main += '</ul>';
          main += `<h3>${nodeLink(page, id)}</h3><ul class="task-list">`;
          current = id;
        }
        const md = new Marked();
        const text = tagBlocked(md.parseInline(task.text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')));
        main += `<li><span class="task-mark" data-state="${state}"></span>${text}</li>`;
      }
      main += '</ul></section>';
    }
    await write(page, layout({ page, title: 'Tasks', currentId: null, main }));
  }

  // ── Glossary ──────────────────────────────────────────────────────
  {
    const page = 'glossary.html';
    const entries = [];
    for (const n of model.nodes.values()) {
      entries.push({ term: n.title, id: n.id, summary: n.summary });
      for (const a of n.aliases) {
        if (normalizeLabel(a) !== normalizeLabel(n.title)) entries.push({ term: a, id: n.id, see: n.title });
      }
    }
    entries.sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
    let main = '<h1>Glossary</h1><p class="lead">Every page and every other name for it. Each term has one home page.</p><dl class="glossary">';
    for (const e of entries) {
      main += e.see
        ? `<dt>${esc(e.term)}</dt><dd>See ${nodeLink(page, e.id, esc(e.see))}.</dd>`
        : `<dt>${nodeLink(page, e.id, esc(e.term))}</dt><dd>${esc(e.summary ?? '')}</dd>`;
    }
    main += '</dl>';
    await write(page, layout({ page, title: 'Glossary', currentId: null, main }));
  }

  return written;
}

/** Node ids in primary-tree order, then nodes that are only in other trees. */
function orderedIds(model) {
  const out = [];
  const seen = new Set();
  const walk = (tree, id) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    for (const k of model.trees[tree].children.get(id) ?? []) walk(tree, k);
  };
  for (const tree of [model.primary, ...Object.keys(model.trees)]) walk(tree, model.trees[tree].top);
  for (const id of model.nodes.keys()) if (!seen.has(id)) out.push(id);
  return out;
}

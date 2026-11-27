import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseMarkdown } from '../src/parse.js';
import { buildModel } from '../src/model.js';
import { resolveConfig } from '../src/config.js';
import { buildSite } from '../src/site.js';
import { readTheme, packageLooks } from '../src/theme.js';
import { fileURLToPath } from 'node:url';

const files = {
  'README.md': '# Demo\n\nIntro.\n\n```mermaid\nflowchart LR\n  gateway --> other_thing\n```\n\n<!-- idk-plans:children:start (generated) -->\n<!-- idk-plans:children:end -->\n',
  'gateway/README.md': '---\nid: gateway\ntitle: Gateway\nsummary: The front door.\nparent: demo\nparents:\n  concern: security.auth\ncode: [gateway/src]\n---\n# Gateway\n\nSee [the docs](../README.md "demo") and [code](src/app.ts). Tag with `#blocked`.\n\n- [x] Done thing\n- [/] Doing thing\n- [ ] Waiting thing #blocked on the router\n- [-] Dropped thing\n',
};

async function build(options) {
  const config = resolveConfig({ root: { file: 'README.md', id: 'demo' }, trees: { system: { primary: true }, concern: { title: 'Concerns' } } });
  const parsed = Object.entries(files).map(([f, t]) => parseMarkdown(f, t));
  const model = buildModel({ config, parsed, exists: () => true });
  const out = await mkdtemp(path.join(tmpdir(), 'idk-site-'));
  const pages = await buildSite({ model, config, cwd: '/' }, out, options);
  const read = (p) => readFile(path.join(out, p), 'utf8');
  return { out, pages, read };
}

test('site: pages for nodes, groups, tasks, and glossary', async () => {
  const { out, pages } = await build();
  for (const p of ['index.html', 'gateway/index.html', 'security/index.html', 'concern/index.html', 'tasks.html', 'glossary.html']) {
    assert.ok(pages.includes(p), p);
  }
  await rm(out, { recursive: true });
});

test('site: links, task states, diagram links, and placed children', async () => {
  const { out, read } = await build({ sourceUrl: 'https://example.org/repo/src/commit/abc' });
  const gw = await read('gateway/index.html');
  assert.match(gw, /<a href="\.\.\/">the docs<\/a>/);
  assert.match(gw, /href="https:\/\/example\.org\/repo\/src\/commit\/abc\/gateway\/src\/app\.ts"/);
  for (const s of ['done', 'doing', 'blocked', 'dropped']) assert.match(gw, new RegExp(`data-state="${s}"`));
  assert.match(gw, /class="tag blocked">#blocked/);
  assert.match(gw, /<code>#blocked<\/code>/);
  const root = await read('index.html');
  assert.match(root, /data-links="\{&quot;gateway&quot;:&quot;gateway\/&quot;\}"/);
  assert.match(root, /<ul class="cards">/);
  assert.doesNotMatch(root, /<h2>Parts<\/h2>/);
  const tasks = await read('tasks.html');
  assert.match(tasks, /Blocked <span class="count">1<\/span>/);
  await rm(out, { recursive: true });
});

test('site: callouts render as collapsible sections, with their tasks', async () => {
  files['docs/callouts.md'] = '---\nid: callouts\ntitle: Callouts\nsummary: Uses callouts.\nparent: demo\n---\n# Callouts\n\n> [!note]- How it works\n> Folded **body**.\n> - [x] Task in a callout\n\n> [!tip]+ Open\n> Shown.\n\n> [!warning]\n> Not foldable.\n\n> A plain quote.\n';
  try {
    const { out, read, pages } = await build();
    const page = await read('callouts/index.html');
    assert.match(page, /<details class="callout" data-callout="note"><summary>How it works<\/summary>\s*<p>Folded <strong>body<\/strong>\.<\/p>/);
    assert.match(page, /<details class="callout" data-callout="tip" open><summary>Open<\/summary>/);
    assert.match(page, /<div class="callout" data-callout="warning"><p class="callout-title">Warning<\/p>/);
    assert.match(page, /<blockquote>\s*<p>A plain quote\.<\/p>/);
    assert.match(page, /data-state="done"/);
    assert.ok(pages.includes('callouts/index.html'));
    await rm(out, { recursive: true });
  } finally {
    delete files['docs/callouts.md'];
  }
});

test('site: uses the CDN by default, and the project\'s own Mermaid with site.mermaid "local"', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'idk-mermaid-'));
  const out = path.join(cwd, '_site');
  try {
    const config = resolveConfig({ root: { file: 'README.md', id: 'demo' } });
    const parsed = Object.entries(files).map(([f, t]) => parseMarkdown(f, t));
    const model = buildModel({ config, parsed, exists: () => true });

    await buildSite({ model, config, cwd }, out);
    assert.match(await readFile(path.join(out, 'index.html'), 'utf8'), /cdn\.jsdelivr\.net\/npm\/mermaid/);

    await assert.rejects(buildSite({ model, config, cwd }, out, { mermaid: 'local' }), /not installed/);

    await mkdir(path.join(cwd, 'node_modules/mermaid/dist'), { recursive: true });
    await writeFile(path.join(cwd, 'node_modules/mermaid/dist/mermaid.min.js'), '/* mermaid */');
    await buildSite({ model, config, cwd }, out);
    assert.match(await readFile(path.join(out, 'index.html'), 'utf8'), /cdn\.jsdelivr/, 'installed is not enough');

    await buildSite({ model, config, cwd }, out, { mermaid: 'local' });
    const root = await readFile(path.join(out, 'index.html'), 'utf8');
    assert.doesNotMatch(root, /cdn\.jsdelivr/);
    assert.match(root, /"assets\/mermaid\.min\.js"/);
    assert.equal(await readFile(path.join(out, 'assets/mermaid.min.js'), 'utf8'), '/* mermaid */');
  } finally {
    await rm(cwd, { recursive: true });
  }
});

test('site: without a theme, no theme stylesheet, theme classes, icons, or contrast switch', async () => {
  const { out, read } = await build();
  const gw = await read('gateway/index.html');
  assert.doesNotMatch(gw, /theme\.css|theme-|tm-look|tm-looks|class="icon"|data-look="tmContrast"/);
  assert.match(gw, /data-look="tmMode"/);
  await rm(out, { recursive: true });
});

test('site: a themetron theme (site.theme) is loaded first, and colors the parts that its colorways cover', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'idk-theme-'));
  const out = path.join(cwd, '_site');
  try {
    const config = resolveConfig({ root: { file: 'README.md', id: 'demo' } });
    const parsed = Object.entries(files).map(([f, t]) => parseMarkdown(f, t));
    const model = buildModel({ config, parsed, exists: () => true });
    const project = { model, config, cwd };

    // A theme with a success colorway, danger under another name, and no warning colorway.
    const css = ':root, .theme-default { --tm-bg-canvas: white; --tm-font-icon: "Icons"; }\n.theme-success { --tm-fill-action: green; }\n.theme-error { --tm-fill-action: red; }\n';
    await writeFile(path.join(cwd, 'theme.css'), css);
    await buildSite(project, out, { theme: 'theme.css' });
    assert.equal(await readFile(path.join(out, 'assets/theme.css'), 'utf8'), css);
    const gw = await readFile(path.join(out, 'gateway/index.html'), 'utf8');
    assert.match(gw, /<html lang="en" class="theme-default">/);
    assert.match(gw, /<link rel="stylesheet" href="\.\.\/assets\/theme\.css">\n<link rel="stylesheet" href="\.\.\/assets\/site\.css">/);
    assert.match(gw, /class="task-mark theme-success" data-state="done"/);
    assert.match(gw, /class="task-mark theme-error" data-state="blocked"/, 'error is another name for danger');
    assert.match(gw, /class="task-mark" data-state="doing"/, 'no warning colorway: the site\'s own colors');
    assert.match(gw, /class="tag blocked theme-error">#blocked/);
    assert.match(gw, /<span class="icon" aria-hidden="true">menu<\/span>/);
    assert.match(gw, /data-look="tmContrast"/);
    assert.doesNotMatch(gw, /tm-look/, 'a theme without looks: site.css draws the parts');

    // Errors: a missing file, and a file that is not a themetron theme.
    await assert.rejects(buildSite(project, out, { theme: 'nope.css' }), /site\.theme: nope\.css does not exist/);
    await writeFile(path.join(cwd, 'plain.css'), 'body { color: red; }');
    await assert.rejects(buildSite(project, out, { theme: 'plain.css' }), /not a themetron theme.*"css" format/);
    await writeFile(path.join(cwd, 'prefixed.css'), ':root { --acme-bg-canvas: white; }');
    await assert.rejects(buildSite(project, out, { theme: 'prefixed.css' }), /prefix "acme".*tm/);
    assert.throws(() => resolveConfig({ site: { theme: 3 } }), /"site\.theme" must be the path/);

    // The themetron token contract: the same breaking version, or no "token contract" line, is read.
    const made = (version) => `/* Made by themetron, token contract ${version}: https://example.org */\n${css}`;
    for (const version of ['0.2.0', '0.2.5', '0.3.0', '0.4.0', '0.5.0']) {
      await writeFile(path.join(cwd, 'versioned.css'), made(version));
      await buildSite(project, out, { theme: 'versioned.css' });
    }
    for (const version of ['0.1.0', '0.6.0', '1.0.0']) {
      await writeFile(path.join(cwd, 'versioned.css'), made(version));
      await assert.rejects(buildSite(project, out, { theme: 'versioned.css' }), new RegExp(`token contract ${version.replace(/\./g, '\\.')}, but idk-plans reads contracts 0\\.2\\.x, 0\\.3\\.x, 0\\.4\\.x, 0\\.5\\.x`));
    }
  } finally {
    await rm(cwd, { recursive: true });
  }
});

test('site: a theme with looks (the "looks" export) puts themetron\'s look classes on the site\'s parts', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'idk-looks-'));
  const out = path.join(cwd, '_site');
  try {
    const config = resolveConfig({ root: { file: 'README.md', id: 'demo' }, trees: { system: { primary: true }, concern: { title: 'Concerns' } } });
    const parsed = Object.entries(files).map(([f, t]) => parseMarkdown(f, t));
    const model = buildModel({ config, parsed, exists: () => true });
    const css = ':root, .theme-default { --tm-bg-canvas: white; }\n.theme-danger { --tm-fill-action: red; }\n.tm-look-fill, .tm-look-tint { color: red; }\n';
    await writeFile(path.join(cwd, 'theme.css'), css);
    await buildSite({ model, config, cwd }, out, { theme: 'theme.css' });
    const gw = await readFile(path.join(out, 'gateway/index.html'), 'utf8');
    assert.match(gw, /<html lang="en" class="theme-default tm-looks">/);
    assert.match(gw, /class="menu tm-look-quiet"/);
    assert.match(gw, /<input type="search" class="tm-look-field"/);
    assert.match(gw, /class="ghost gear tm-look-ghost"/);
    assert.match(gw, /class="ghost collapse tm-look-ghost"/);
    assert.match(gw, /class="settings tm-look-surface tm-enter-pop"/);
    assert.match(gw, /class="tag blocked theme-danger tm-look-tint">#blocked/);
    assert.match(await readFile(path.join(out, 'index.html'), 'utf8'), /<li class="card tm-look-surface">/);

    // The looks as their own file (site.looks), after the theme's tokens.
    await writeFile(path.join(cwd, 'tokens.css'), ':root, .theme-default { --tm-bg-canvas: white; }\n');
    await writeFile(path.join(cwd, 'looks.css'), '.tm-look-fill { color: red; }\n');
    await buildSite({ model, config, cwd }, out, { theme: 'tokens.css', looks: 'looks.css' });
    const page = await readFile(path.join(out, 'gateway/index.html'), 'utf8');
    assert.match(page, /assets\/theme\.css">\n<link rel="stylesheet" href="\.\.\/assets\/looks\.css">\n<link rel="stylesheet" href="\.\.\/assets\/site\.css">/);
    assert.match(page, /class="ghost gear tm-look-ghost"/);
    assert.equal(await readFile(path.join(out, 'assets/looks.css'), 'utf8'), '.tm-look-fill { color: red; }\n');
    // A package name, as themetron's docs give it: found through the package's exports.
    await buildSite({ model, config, cwd }, out, { theme: 'tokens.css', looks: '@method-run/idk-themetron/looks.css' });
    assert.equal(await readFile(path.join(out, 'assets/looks.css'), 'utf8'), (await packageLooks()).css);
    await assert.rejects(buildSite({ model, config, cwd }, out, { theme: 'tokens.css', looks: '@method-run/nope/looks.css' }), /nope\/looks\.css does not exist, as a path from the project root or as a package file/);
    await assert.rejects(buildSite({ model, config, cwd }, out, { looks: 'looks.css' }), /site\.looks needs a theme/);
    await assert.rejects(buildSite({ model, config, cwd }, out, { theme: 'tokens.css', looks: 'tokens.css' }), /not themetron's looks\.css/);
    assert.throws(() => resolveConfig({ site: { looks: '' } }), /"site\.looks" must be/);
  } finally {
    await rm(cwd, { recursive: true });
  }
});

test('site: a themetron inputs file (this repository\'s docs/theme.inputs.json) builds a theme with every colorway', async () => {
  const theme = await readTheme(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), 'docs/theme.inputs.json');
  assert.ok(theme.inputs);
  assert.match(theme.css, /^\/\* Made by themetron/);
  assert.equal(theme.root, 'theme-default');
  assert.match(theme.contract, /^0\.5\./);
  assert.ok(theme.icons);
  for (const colorway of ['success', 'warning', 'danger']) assert.ok(theme.classes[colorway], colorway);
});

test('site: a theme from an inputs file: its errors, and site.looks false', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'idk-inputs-'));
  const out = path.join(cwd, '_site');
  try {
    const config = resolveConfig({ root: { file: 'README.md', id: 'demo' } });
    const parsed = Object.entries(files).map(([f, t]) => parseMarkdown(f, t));
    const model = buildModel({ config, parsed, exists: () => true });
    const project = { model, config, cwd };
    await writeFile(path.join(cwd, 'theme.json'), JSON.stringify({ version: 2, themes: { default: { base: '#336699' }, danger: { parent: 'default', action: { color: '#cc0000' } } } }));
    // The looks come from the installed themetron.
    await buildSite(project, out, { theme: 'theme.json' });
    const looks = await readFile(path.join(out, 'assets/looks.css'), 'utf8');
    assert.equal(looks, (await packageLooks()).css);
    assert.match(looks, /\.tm-look-fill\b/);
    assert.match(await readFile(path.join(out, 'gateway/index.html'), 'utf8'), /assets\/looks\.css/);

    await buildSite(project, out, { theme: 'theme.json', looks: false });
    const css = await readFile(path.join(out, 'assets/theme.css'), 'utf8');
    assert.match(css, /--tm-bg-canvas:/);
    const gw = await readFile(path.join(out, 'gateway/index.html'), 'utf8');
    assert.match(gw, /class="tag blocked theme-danger">#blocked/);
    assert.doesNotMatch(gw, /tm-look|looks\.css/, 'site.looks false: no looks');

    await assert.rejects(buildSite(project, out, { theme: 'nope.json' }), /site\.theme: nope\.json does not exist/);
    await writeFile(path.join(cwd, 'broken.json'), '{ nope');
    await assert.rejects(buildSite(project, out, { theme: 'broken.json' }), /broken\.json is not a themetron inputs file/);
    await writeFile(path.join(cwd, 'bad.json'), JSON.stringify({ version: 2, themes: { default: { base: 'not a color' } } }));
    await assert.rejects(buildSite(project, out, { theme: 'bad.json' }), /site\.theme: bad\.json: /);
  } finally {
    await rm(cwd, { recursive: true });
  }
});

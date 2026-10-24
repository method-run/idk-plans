import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseMarkdown } from '../src/parse.js';
import { buildModel } from '../src/model.js';
import { resolveConfig } from '../src/config.js';
import { buildSite } from '../src/site.js';

const files = {
  'README.md': '# Demo\n\nIntro.\n\n```mermaid\nflowchart LR\n  gateway --> other_thing\n```\n\n<!-- idk-plans:children:start (generated) -->\n<!-- idk-plans:children:end -->\n',
  'gateway/README.md': '---\nid: gateway\ntitle: Gateway\nsummary: The front door.\nparent: demo\nparents:\n  concern: security.auth\ncode: [gateway/src]\n---\n# Gateway\n\nSee [the docs](../README.md "demo") and [code](src/app.ts).\n\n- [x] Done thing\n- [/] Doing thing\n- [ ] Waiting thing #blocked on the router\n- [-] Dropped thing\n',
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
  const root = await read('index.html');
  assert.match(root, /data-links="\{&quot;gateway&quot;:&quot;gateway\/&quot;\}"/);
  assert.match(root, /<ul class="cards">/);
  assert.doesNotMatch(root, /<h2>Parts<\/h2>/);
  const tasks = await read('tasks.html');
  assert.match(tasks, /Blocked <span class="count">1<\/span>/);
  await rm(out, { recursive: true });
});

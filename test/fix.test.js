import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseMarkdown } from '../src/parse.js';
import { buildModel } from '../src/model.js';
import { loadConfig, resolveConfig } from '../src/config.js';
import { scanFiles } from '../src/scan.js';
import { check, fixDocument } from '../src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/idk-plans.js');
const run = promisify(execFile);

/** Run fix on every node, in memory, and return the new files. */
function fixAll(files, config, exists) {
  const parsed = Object.entries(files).map(([file, text]) => parseMarkdown(file, text));
  const model = buildModel({ config, parsed, exists: (p) => p in files || exists(p) });
  const out = { ...files };
  for (const node of model.nodes.values()) if (node.doc) out[node.file] = fixDocument(model, node);
  return { out, project: { config, model: buildModel({ config, parsed: Object.entries(out).map(([f, t]) => parseMarkdown(f, t)), exists: (p) => p in out || exists(p) }) } };
}

/** fix must reach a fixed point in one run: a second run changes nothing. */
function assertSettles(files, config, exists = () => false) {
  const first = fixAll(files, config, exists);
  const second = fixAll(first.out, config, exists);
  for (const file of Object.keys(files)) {
    assert.equal(second.out[file], first.out[file], `second fix changed ${file}`);
  }
  const left = check(first.project).filter((p) => ['stale-generated', 'hard-wrap', 'task-parent-mismatch'].includes(p.rule));
  assert.deepEqual(left, [], 'fix left problems that it should correct');
}

async function readProject(dir) {
  const config = await loadConfig(dir);
  const files = {};
  for (const f of await scanFiles(dir, config)) files[f] = await readFile(path.join(dir, f), 'utf8');
  return { files, config, exists: (p) => existsSync(path.join(dir, p)) };
}

test('fix settles in one run: test fixture', async () => {
  const { files, config, exists } = await readProject(path.join(ROOT, 'test/fixtures/basic'));
  assertSettles(files, config, exists);
});

test('fix settles in one run: this repository', async () => {
  const { files, config, exists } = await readProject(ROOT);
  assertSettles(files, config, exists);
  // The committed docs are already fixed.
  const { out } = fixAll(files, config, exists);
  for (const file of Object.keys(files)) assert.equal(out[file], files[file], `${file} is not fixed`);
});

test('fix settles in one run: a project that needs every kind of fix', () => {
  const config = resolveConfig({ root: { file: 'README.md', id: 'root' }, trees: { system: { primary: true }, concern: { groups: ['security'] } } });
  assertSettles({
    'README.md': [
      '# Root',
      '',
      'Start with [gateway], then [the store][trust-store].',
      '',
      '```mermaid',
      'flowchart LR',
      '  gateway --> trust_store',
      '```',
      '',
      '<!-- idk-plans:children:start (generated) -->',
      'old text',
      '<!-- idk-plans:children:end -->',
      '',
      '<!-- idk-plans:trees:start (generated) -->',
      '<!-- idk-plans:trees:end -->',
      '',
      '<!-- idk-plans:refs:start (generated) -->',
      '[gateway]: ./old/path.md',
      '<!-- idk-plans:refs:end -->',
    ].join('\n'),
    'gateway/README.md': [
      '---',
      'id: gateway',
      'title: Gateway',
      'summary: The front door.',
      'parent: root',
      'tags: [mine, system/wrong/place]',
      '---',
      '# Gateway',
      '',
      'Text that is',
      'wrapped by hand.',
      '',
      '> [!note]- How it works',
      '> A callout',
      '> body.',
      '',
      '- [x] Parent',
      '  - [ ] Child',
      '  - [x] Done child',
      '- [ ] Waiting #blocked on [trust-store]',
    ].join('\n'),
    'gateway/trust/README.md': [
      '---',
      'id: trust-store',
      'title: Trust store',
      'summary: Keeps the peers that you trust.',
      'parent: gateway',
      'parents:',
      '  concern: security',
      'aliases: [trusted peers]',
      '---',
      '# Trust store',
      '',
      'Back to [the gateway](../../wrong.md "gateway"). See [trusted peers].',
      '',
      '- [~] Dropped',
      '- [/] Doing',
    ].join('\n'),
  }, config);
});

test('cli: exit codes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'idk-cli-'));
  const cli = (...args) => run(process.execPath, [BIN, ...args, '--cwd', dir]).then(() => 0, (e) => e.code);
  try {
    await writeFile(path.join(dir, 'README.md'), '# Root\n');
    assert.equal(await cli('check'), 0);

    await mkdir(path.join(dir, 'a'));
    await writeFile(path.join(dir, 'a/README.md'), '---\nid: a\ntitle: A\nsummary: A.\nparent: nope\n---\n# A\n');
    assert.equal(await cli('check'), 1);

    assert.equal(await cli('nope'), 1);

    await writeFile(path.join(dir, 'idk-plans.config.json'), '{ not json');
    assert.equal(await cli('check'), 2);
  } finally {
    await rm(dir, { recursive: true });
  }
});

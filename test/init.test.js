import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { initProject, idFromName, CI_TEMPLATES, HOOK_TEMPLATES } from '../src/init.js';
import { diffLines } from '../src/diff.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/idk-plans.js');
const run = promisify(execFile);

async function withDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'idk-init-'));
  try { await fn(dir); } finally { await rm(dir, { recursive: true }); }
}

test('idFromName makes a valid id', () => {
  assert.equal(idFromName('@acme/My App'), 'my-app');
  assert.equal(idFromName('idk_plans.v2'), 'idk-plans-v2');
  assert.equal(idFromName('!!!'), 'project');
});

test('init writes a clean project, and skips files that exist', () => withDir(async (dir) => {
  await writeFile(path.join(dir, 'package.json'), '{ "name": "@acme/My App" }');
  await writeFile(path.join(dir, '.gitignore'), 'node_modules/');
  const { stdout } = await run(process.execPath, [BIN, 'init', '--ci', 'github', '--hooks', '--cwd', dir]);
  assert.match(stdout, /created +idk-plans\.config\.json/);
  assert.match(stdout, /updated +\.gitignore/);

  const config = JSON.parse(await readFile(path.join(dir, 'idk-plans.config.json'), 'utf8'));
  assert.deepEqual(config.root, { file: 'README.md', id: 'my-app' });
  assert.equal(await readFile(path.join(dir, '.gitignore'), 'utf8'), 'node_modules/\n_site/\n');
  assert.equal(await readFile(path.join(dir, CI_TEMPLATES.github.file), 'utf8'), CI_TEMPLATES.github.text);
  assert.ok((await stat(path.join(dir, '.githooks/pre-commit'))).mode & 0o100, 'hook is executable');

  // The new project has no problems.
  await run(process.execPath, [BIN, 'check', '--cwd', dir]);

  const before = await readFile(path.join(dir, 'README.md'), 'utf8');
  const again = await initProject(dir, { ci: 'github', hooks: true });
  assert.ok(again.every((r) => r.action === 'skipped'), JSON.stringify(again));
  assert.equal(await readFile(path.join(dir, 'README.md'), 'utf8'), before);
}));

test('init rejects an unknown host before it writes', () => withDir(async (dir) => {
  await assert.rejects(initProject(dir, { ci: 'nope' }), /--ci/);
  const code = await run(process.execPath, [BIN, 'init', '--ci', 'nope', '--cwd', dir]).then(() => 0, (e) => e.code);
  assert.equal(code, 2);
  await assert.rejects(stat(path.join(dir, 'idk-plans.config.json')));
}));

test('the init templates match the docs', async () => {
  const guide = await readFile(path.join(ROOT, 'docs/publish-site.md'), 'utf8');
  for (const [host, { text }] of Object.entries(CI_TEMPLATES)) {
    assert.ok(guide.includes(`\`\`\`yaml\n${text}\`\`\``), `docs/publish-site.md has the ${host} workflow`);
  }
  const readme = await readFile(path.join(ROOT, 'README.md'), 'utf8');
  for (const [hook, text] of Object.entries(HOOK_TEMPLATES)) {
    assert.ok(readme.includes(`\`.githooks/${hook}\`:\n\n\`\`\`sh\n${text}\`\`\``), `README.md has the ${hook} hook`);
  }
});

test('fix --dry-run shows the changes, and writes nothing', () => withDir(async (dir) => {
  await writeFile(path.join(dir, 'idk-plans.config.json'), '{ "root": { "file": "README.md", "id": "root" } }');
  await writeFile(path.join(dir, 'README.md'), '# Root\n\nText that is\nwrapped by hand.\n');
  const { stdout } = await run(process.execPath, [BIN, 'fix', '--dry-run', '--cwd', dir]);
  assert.match(stdout, /would fix README\.md/);
  assert.match(stdout, /- Text that is\n.*- wrapped by hand\.\n.*\+ Text that is wrapped by hand\./);
  assert.match(stdout, /1 files would change/);
  assert.equal(await readFile(path.join(dir, 'README.md'), 'utf8'), '# Root\n\nText that is\nwrapped by hand.\n');
}));

test('diffLines shows changed lines with context', () => {
  assert.deepEqual(diffLines('a\nb\nc\nd\ne', 'a\nb\nC\nd\ne'), ['@@ line 2 @@', '  b', '- c', '+ C', '  d']);
  assert.deepEqual(diffLines('a\nb', 'a\nb'), []);
  assert.deepEqual(diffLines('a\nz', 'x\na\nz\ny', 0), ['@@ line 1 @@', '+ x', '@@ line 3 @@', '+ y']);
});

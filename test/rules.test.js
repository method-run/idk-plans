import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../src/parse.js';
import { buildModel } from '../src/model.js';
import { resolveConfig, DEFAULT_RULES } from '../src/config.js';
import { check, fixDocument } from '../src/index.js';

// One test for each rule in SPEC.md section 10. Each case starts from a clean
// project and adds the smallest change that breaks the rule.

const CONFIG = { root: { file: 'README.md', id: 'root' }, trees: { system: { primary: true }, concern: {} } };

function page(id, fields = {}, body = '') {
  const fm = Object.entries({ id, title: id, summary: `About ${id}.`, ...fields })
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return `---\n${fm}\n---\n# ${id}\n\n${body}\n`;
}

const CLEAN = {
  'README.md': '# Root\n\nThe [A](a.md "a") page.\n',
  'a.md': page('a', { parent: 'root' }, '- [x] One thing\n- [ ] Another thing'),
};

function project(files, raw = CONFIG, existing = []) {
  const config = resolveConfig(raw);
  const parsed = Object.entries(files).map(([file, text]) => parseMarkdown(file, text));
  const paths = new Set([...Object.keys(files), ...existing]);
  return { config, model: buildModel({ config, parsed, exists: (p) => paths.has(p) }) };
}

/** Run fix on every node, in memory. */
function fixed(files, raw = CONFIG) {
  const { model } = project(files, raw);
  const out = { ...files };
  for (const node of model.nodes.values()) if (node.doc) out[node.file] = fixDocument(model, node);
  return out;
}

const rulesIn = (p) => check(p).map((x) => x.rule);

test('rules: a clean project has no problems after fix', () => {
  assert.deepEqual(check(project(fixed(CLEAN))), []);
});

const CASES = {
  'frontmatter': { 'bad.md': '---\nid: Not An Id\n---\n# Bad\n' },
  'duplicate-id': { 'a2.md': page('a', { parent: 'root' }) },
  'missing-parent': { 'b.md': page('b', { parent: 'nope', status: 'todo' }) },
  'no-primary-parent': { 'b.md': page('b', { status: 'todo' }) },
  'cycle': {
    'b.md': page('b', { parent: 'root', parents: { concern: 'c' }, status: 'todo' }),
    'c.md': page('c', { parent: 'root', parents: { concern: 'b' }, status: 'todo' }),
  },
  'path-mismatch': { 'b.md': page('b', { parent: 'other.a', status: 'todo' }) },
  'unknown-tree': { 'b.md': page('b', { parent: 'root', parents: { nope: 'root' }, status: 'todo' }) },
  'broken-ref': { 'a.md': page('a', { parent: 'root' }, 'See [this][no-such-label].\n\n- [ ] Task') },
  'broken-link': { 'a.md': page('a', { parent: 'root' }, 'See [this](missing.md).\n\n- [ ] Task') },
  'missing-code': { 'a.md': page('a', { parent: 'root', code: ['src/missing.js'] }, '- [ ] Task') },
  'stale-generated': { 'README.md': '# Root\n\n<!-- idk-plans:children:start (generated) -->\n<!-- idk-plans:children:end -->\n' },
  'bad-status': { 'a.md': page('a', { parent: 'root', status: 'done' }, '- [ ] Task') },
  'task-parent-mismatch': { 'a.md': page('a', { parent: 'root' }, '- [x] Parent\n  - [ ] Child') },
  'unknown-mark': { 'a.md': page('a', { parent: 'root' }, '- [?] Typo\n- [ ] Task') },
  'hard-wrap': { 'a.md': page('a', { parent: 'root' }, 'A paragraph\nwrapped by hand.\n\n- [ ] Task') },
  'summary-max-words': { 'a.md': page('a', { parent: 'root', summary: `${'word '.repeat(30).trim()}.` }, '- [ ] Task') },
  'plan-finished': { 'a.md': page('a', { parent: 'root', kind: 'plan' }, '- [x] All done') },
  'unlinked-child': { 'README.md': '# Root\n\nNo links here.\n' },
  'orphan-file': { 'notes.md': '# Notes\n' },
  'no-progress': { 'a.md': page('a', { parent: 'root', kind: 'module' }, 'No tasks.') },
};

test('rules: every rule in the defaults has a case', () => {
  assert.deepEqual(Object.keys(CASES).sort(), Object.keys(DEFAULT_RULES).sort());
});

for (const [rule, change] of Object.entries(CASES)) {
  test(`rule ${rule}`, () => {
    const files = fixed({ ...CLEAN, ...change });
    // fix corrects some rules, so check the change itself for those.
    const source = ['stale-generated', 'hard-wrap', 'task-parent-mismatch'].includes(rule)
      ? { ...fixed(CLEAN), ...change }
      : files;
    const p = project(source);
    assert.ok(rulesIn(p).includes(rule), `${rule} not reported: ${JSON.stringify(check(p))}`);
    const expected = [DEFAULT_RULES[rule]].flat()[0];
    assert.equal(check(p).find((x) => x.rule === rule).severity, expected);

    const off = project(source, { ...CONFIG, rules: { [rule]: 'off' } });
    assert.ok(!rulesIn(off).includes(rule), `${rule} still reported when off`);
  });
}

test('rules: severity and options come from the configuration', () => {
  const files = fixed({ ...CLEAN, ...CASES['summary-max-words'] });
  const loud = project(files, { ...CONFIG, rules: { 'summary-max-words': ['error', 40] } });
  assert.ok(!rulesIn(loud).includes('summary-max-words'), '40 words allowed');
  const strict = project(files, { ...CONFIG, rules: { 'summary-max-words': ['error', 10] } });
  assert.equal(check(strict).find((x) => x.rule === 'summary-max-words').severity, 'error');
});

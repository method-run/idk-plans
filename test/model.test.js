import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../src/parse.js';
import { buildModel, aggregateState } from '../src/model.js';
import { resolveConfig } from '../src/config.js';
import { fixDocument, rollupText, treeTags } from '../src/fix.js';

const TWO_TREES = { trees: { system: { primary: true }, concern: { title: 'Concerns' } } };

function node(id, fields = {}, body = '') {
  const fm = Object.entries({ id, title: id, summary: `About ${id}.`, ...fields })
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return [`${id}.md`, `---\n${fm}\n---\n# ${id}\n\n${body}\n`];
}

function model(files, rawConfig = {}, existing = []) {
  const config = resolveConfig(rawConfig);
  const parsed = files.map(([file, text]) => parseMarkdown(file, text));
  const paths = new Set([...files.map(([f]) => f), ...existing]);
  return buildModel({ config, parsed, exists: (p) => paths.has(p) });
}

const rules = (m) => m.problems.map((p) => p.rule);
const errors = (m) => m.problems.filter((p) => p.severity === 'error');

test('parses task marks, nesting, and skips code blocks', () => {
  const doc = parseMarkdown('a.md', [
    '- [x] one',
    '- [/] two',
    '  - [ ] two a #blocked waiting on b',
    '  - [>] two b',
    '```',
    '- [ ] not a task',
    '```',
    'Paragraph',
    '- [-] three',
    '- [?] not a known mark',
  ].join('\n'));
  assert.deepEqual(doc.unknownMarks.map((u) => u.mark), ['?']);
  assert.deepEqual(doc.tasks.map((t) => [t.state, t.parent]), [
    ['done', null], ['doing', null], ['blocked', 1], ['deferred', 1], ['dropped', null],
  ]);
});

test('task marks are not read as references', () => {
  const doc = parseMarkdown('a.md', '- [x] see [gateway]\n');
  assert.deepEqual(doc.refsUsed.map((r) => r.label), ['gateway']);
});

test('aggregateState', () => {
  assert.equal(aggregateState(['done', 'done', 'dropped']), 'done');
  assert.equal(aggregateState(['done', 'todo']), 'doing');
  assert.equal(aggregateState(['dropped', 'deferred']), 'deferred');
  assert.equal(aggregateState(['todo']), 'todo');
});

test('rollups count each task once, even through two routes', () => {
  const m = model([
    node('root', {}, ''),
    node('a', { parent: 'root', parents: { concern: ['sec.x', 'sec.y'] } }, '- [x] t1\n- [ ] t2'),
  ], TWO_TREES);
  assert.deepEqual(errors(m), []);
  const sec = m.nodes.get('sec').rollup.concern;
  assert.equal(sec.scope, 2);
  assert.equal(sec.done, 1);
  assert.equal(m.nodes.get('root').rollup.system.percent, 50);
});

test('a single unknown parent id is missing-parent, a longer path makes virtual nodes', () => {
  const m = model([
    node('root'),
    node('a', { parent: 'gatway' }),
    node('b', { parent: 'root', parents: { concern: 'security.auth' } }),
  ], TWO_TREES);
  assert.ok(rules(m).includes('missing-parent'));
  assert.equal(m.nodes.get('security').virtual, true);
  assert.deepEqual(m.trees.concern.parents.get('auth'), ['security']);
  assert.deepEqual(m.trees.concern.parents.get('security'), ['concern']);
});

test('path-mismatch when a path disagrees with a declared parent', () => {
  const m = model([
    node('root'),
    node('gateway', { parent: 'root' }),
    node('other', { parent: 'root' }),
    node('trust', { parent: 'other.gateway' }),
  ]);
  assert.ok(rules(m).includes('path-mismatch'));
});

test('paths position real nodes that do not declare a parent in that tree', () => {
  const m = model([
    node('root'),
    node('auth', { parent: 'root' }),
    node('b', { parent: 'root', parents: { concern: 'security.auth' } }),
  ], TWO_TREES);
  assert.deepEqual(m.trees.concern.parents.get('auth'), ['security']);
  assert.deepEqual(errors(m), []);
});

test('cycles are reported', () => {
  const m = model([node('root'), node('a', { parent: 'b' }), node('b', { parent: 'a' })]);
  assert.ok(rules(m).includes('cycle'));
});

test('status: leaf status counts as a task; dropped takes a branch out of scope', () => {
  const m = model([
    node('root'),
    node('leaf', { parent: 'root', status: 'done' }),
    node('gone', { parent: 'root', status: 'dropped' }, '- [ ] never'),
    node('kid', { parent: 'gone' }, '- [x] old'),
    node('bad', { parent: 'root', status: 'doing' }, '- [ ] t'),
  ]);
  const r = m.nodes.get('root').rollup.system;
  assert.equal(r.states.dropped, 2);
  assert.equal(r.done, 1);
  assert.ok(rules(m).includes('bad-status'));
});

test('broken refs, broken links, missing code, unlinked children', () => {
  const m = model([
    node('root', {}, 'Nothing here.'),
    node('a', { parent: 'root', code: ['src/a'] }, '[x][nope] and [file](./missing.md) and [ok](./b.md)'),
    ['b.md', 'not a node'],
  ]);
  const r = rules(m);
  for (const rule of ['broken-ref', 'broken-link', 'missing-code', 'unlinked-child', 'orphan-file']) {
    assert.ok(r.includes(rule), rule);
  }
});

test('rollupText', () => {
  const r = (states) => ({ ...states, scope: states.done + states.open });
  assert.equal(rollupText(null), '');
  assert.equal(rollupText({ scope: 4, done: 4, percent: 100, states: { blocked: 0, deferred: 0, dropped: 1 } }), '● 100% (4/4) · 1 dropped');
  assert.equal(rollupText({ scope: 15, done: 8, percent: 53, states: { blocked: 2, deferred: 0, dropped: 0 } }), '◐ 53% (8/15) · 2 blocked');
  assert.equal(rollupText({ scope: 0, done: 0, percent: null, states: { blocked: 0, deferred: 1, dropped: 0 } }), '· no tasks · 1 deferred');
  void r;
});

test('fix writes blocks, turns id references into inline links, corrects marks, and is idempotent', () => {
  const files = [
    node('root', {}, '<!-- idk-plans:children:start (generated) -->\n<!-- idk-plans:children:end -->'),
    node('a', { parent: 'root', aliases: ['old-a'] }, 'See [the b page][old-b], [b], `[b]`, and [moved](./gone.md#part "b").\n\n```mermaid\nflowchart LR\n  a --> b\n```\n\n- [ ] parent\n  - [x] sub'),
    node('b', { parent: 'root', title: 'Bee', aliases: ['old-b'] }, 'Back to [a].'),
  ];
  const m1 = model(files);
  const fixed = fixDocument(m1, m1.nodes.get('a'));
  assert.match(fixed, /See \[the b page\]\(\.\/b\.md "b"\), \[Bee\]\(\.\/b\.md "b"\), `\[b\]`, and \[moved\]\(\.\/b\.md#part "b"\)\./);
  assert.match(fixed, /- \[x\] parent/);
  assert.match(fixed, /Zoom in: \[Bee\]\(\.\/b\.md "b"\)/);
  assert.match(fixed, /idk-plans:progress:start/);
  assert.doesNotMatch(fixed, /idk-plans:refs/);
  // A link whose title is an id is managed: a stale path is fixed, not reported as broken.
  assert.ok(!m1.problems.some((p) => p.rule === 'broken-link'));

  const rootFixed = fixDocument(m1, m1.nodes.get('root'));
  assert.match(rootFixed, /- \[a\]\(\.\/a\.md "a"\): About a\./);

  // Fixing the fixed files changes nothing.
  const fixedFiles = files.map(([f]) => [f, fixDocument(m1, m1.byFile.get(f))]);
  const m2 = model(fixedFiles);
  for (const [f, text] of fixedFiles) assert.equal(fixDocument(m2, m2.byFile.get(f)), text, f);
});

test('old refs blocks are removed', () => {
  const m = model([node('root'), node('a', { parent: 'root' }, 'x\n\n<!-- idk-plans:refs:start (generated) -->\n[root]: ./root.md\n<!-- idk-plans:refs:end -->')]);
  assert.doesNotMatch(fixDocument(m, m.nodes.get('a')), /refs|\[root\]:/);
});

test('configured groups make virtual nodes that single-id parents can use', () => {
  const m = model([
    node('root'),
    node('a', { parent: 'root', parents: { concern: 'reachability' } }),
    node('b', { parent: 'root', parents: { concern: 'privacy' } }),
  ], { trees: { system: { primary: true }, concern: { groups: ['reachability', 'safety.backup'] } } });
  assert.deepEqual(m.trees.concern.parents.get('a'), ['reachability']);
  assert.deepEqual(m.trees.concern.parents.get('reachability'), ['concern']);
  assert.deepEqual(m.trees.concern.parents.get('backup'), ['safety']);
  assert.equal(m.problems.filter((p) => p.rule === 'missing-parent').length, 1);
});

test('mermaid edge labels and virtual nodes do not become zoom links', () => {
  const m = model([
    node('root', {}, '```mermaid\nflowchart LR\n  a -- talks to b --> c\n  a -. b .-> c\n```'),
    node('a', { parent: 'root' }), node('b', { parent: 'root' }), node('c', { parent: 'root', parents: { concern: 'grp.c' } }),
  ], TWO_TREES);
  assert.deepEqual(m.nodes.get('root').doc.mermaid[0].ids, ['a', 'c']);
});

test('fix adds the title to aliases without disturbing other frontmatter', () => {
  const files = [node('root'), node('trust', { parent: 'root', title: 'Trust store', aliases: ['peers'] }, 'Body')];
  const m = model(files);
  const fixed = fixDocument(m, m.nodes.get('trust'));
  assert.match(fixed, /aliases:.*peers.*Trust store/s);
  assert.match(fixed, /^# trust$/m);
  const m2 = model([files[0], ['trust.md', fixed]]);
  assert.equal(fixDocument(m2, m2.nodes.get('trust')), fixed);
});

test('a blocked tag counts as blocked in rollups but leaves parent marks alone', () => {
  const m = model([node('root'), node('a', { parent: 'root' }, '- [/] parent\n  - [x] one\n  - [ ] two #blocked')]);
  assert.equal(m.nodes.get('a').rollup.system.states.blocked, 1);
  assert.ok(!m.problems.some((p) => p.rule === 'task-parent-mismatch'));
});

test('title alias edits keep frontmatter formatting', () => {
  const text = (aliases) => `---\nid: trust\ntitle: Trust store\nsummary: >-\n  Line one.\n  Line two.\nparent: root\n${aliases}---\n# Trust\n`;
  const run = (aliases) => {
    const m = model([node('root'), ['trust.md', text(aliases)]]);
    return fixDocument(m, m.nodes.get('trust')).split('---')[1];
  };
  assert.match(run('aliases: [peers]\n'), /\n  Line one\.\n  Line two\.\n[\s\S]*aliases: \[peers, Trust store\]\n/);
  assert.match(run('aliases:\n  - peers\n'), /aliases:\n  - peers\n  - Trust store\n/);
  assert.match(run(''), /parent: root\naliases: \[Trust store\]\n/);
});

test('tree tags: one per place in each tree, primary first, user tags kept', () => {
  const files = [
    node('root'),
    node('gateway', { parent: 'root' }),
    node('trust', { parent: 'gateway', parents: { concern: ['security.peer-auth', 'privacy'] }, tags: ['mine', 'concern/stale'] }),
  ];
  const cfg = { trees: { system: { primary: true }, concern: { groups: ['privacy'] } } };
  const m = model(files, cfg);
  assert.deepEqual(treeTags(m, 'trust'), ['system/gateway/trust', 'concern/security/peer-auth/trust', 'concern/privacy/trust']);
  const fixed = fixDocument(m, m.nodes.get('trust'));
  assert.match(fixed, /tags: \[system\/gateway\/trust, concern\/security\/peer-auth\/trust, concern\/privacy\/trust, mine\]/);
  const m2 = model([files[0], files[1], ['trust.md', fixed]], cfg);
  assert.equal(fixDocument(m2, m2.nodes.get('trust')), fixed);
  const off = model(files, { ...cfg, tags: false });
  assert.doesNotMatch(fixDocument(off, off.nodes.get('trust')), /system\/gateway/);
});

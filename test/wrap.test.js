import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marked } from 'marked';
import { unwrapProse } from '../src/wrap.js';
import { parseMarkdown } from '../src/parse.js';
import { buildModel } from '../src/model.js';
import { resolveConfig } from '../src/config.js';
import { check, fixDocument } from '../src/index.js';

// Soft breaks render as "\n" in HTML; collapse whitespace to compare meaning.
const render = (md) => marked.parse(md).replace(/\s+/g, ' ').replace(/> </g, '><').trim();

const WRAPPED = [
  '---',
  'id: a',
  'title: A',
  'summary: About a.',
  '---',
  '# A',
  '',
  'One paragraph',
  'wrapped by hand.',
  '',
  '- An item',
  '  that continues.',
  '- [ ] A task',
  '  that continues.',
  '',
  '> A quote',
  '> that continues.',
].join('\n');

test('unwraps paragraphs, list items, and quotes', () => {
  const { text, wrapped } = unwrapProse(WRAPPED);
  assert.deepEqual(text.split('\n').slice(7), [
    'One paragraph wrapped by hand.',
    '',
    '- An item that continues.',
    '- [ ] A task that continues.',
    '',
    '> A quote that continues.',
  ]);
  assert.deepEqual(wrapped, [7, 10, 12, 15]);
  assert.equal(render(text), render(WRAPPED));
});

test('leaves blocks alone where a line break has meaning', () => {
  const text = [
    '---',
    'summary: >-',
    '  folded',
    '  yaml',
    '---',
    'Hard break  ',
    'next line.',
    '',
    'Setext',
    '======',
    '',
    'a | b',
    '--- | ---',
    '1 | 2',
    '3 | 4',
    '',
    '```',
    'code',
    'block',
    '```',
    '',
    '    indented',
    '    code',
    '',
    '<details>',
    '<summary>Why</summary>',
    '',
    'Body.',
    '',
    '</details>',
    '',
    '[label]: https://example.com',
    '[other]: https://example.org',
    '',
    'Text',
    '- list starts',
    '# heading',
    'Text',
    '***',
  ].join('\n');
  const result = unwrapProse(text);
  assert.equal(result.text, text);
  assert.deepEqual(result.wrapped, []);
});

test('fix unwraps and check reports, unless proseWrap is "preserve"', () => {
  const project = (raw) => {
    const config = resolveConfig(raw);
    const model = buildModel({ config, parsed: [parseMarkdown('a.md', WRAPPED)], exists: () => true });
    return { config, model };
  };
  const never = project({});
  const node = never.model.nodes.get('a');
  assert.match(fixDocument(never.model, node), /One paragraph wrapped by hand\./);
  assert.deepEqual(
    check(never).filter((p) => p.rule === 'hard-wrap').map((p) => p.line),
    [8, 11, 13, 16],
  );

  const preserve = project({ proseWrap: 'preserve' });
  assert.match(fixDocument(preserve.model, preserve.model.nodes.get('a')), /One paragraph\nwrapped/);
  assert.equal(check(preserve).filter((p) => p.rule === 'hard-wrap').length, 0);

  assert.throws(() => resolveConfig({ proseWrap: 'always' }), /proseWrap/);
});

test('keeps a callout title on its own line, and counts tasks in callouts', () => {
  const text = '> [!note]- How it works\n> The body\n> continues.\n> - [ ] A task\n';
  assert.equal(unwrapProse(text).text, '> [!note]- How it works\n> The body continues.\n> - [ ] A task\n');
  const doc = parseMarkdown('a.md', text);
  assert.deepEqual(doc.tasks.map((t) => [t.state, t.text]), [['todo', 'A task']]);
});

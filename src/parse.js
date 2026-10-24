import YAML from 'yaml';

export const MARK_STATES = {
  ' ': 'todo',
  '/': 'doing',
  'x': 'done',
  'X': 'done',
  '>': 'deferred',
  '-': 'dropped',
};

export const STATE_MARKS = {
  todo: ' ', doing: '/', done: 'x', deferred: '>', dropped: '-',
};

// An open task with this tag is blocked. The mark stays [ ] or [/].
export const BLOCKED_TAG = /(^|\s)#blocked\b/;

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const TASK = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([^\]])\]\s+(.*)$/;
const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const REF_DEF = /^\s{0,3}\[([^\]]+)\]:\s*(\S+)/;
const GEN_START = /<!--\s*idk-plans:([a-z-]+):start\b.*?-->/;
const GEN_END = /<!--\s*idk-plans:([a-z-]+):end\s*-->/;
const PROGRESS_OFF = /<!--\s*idk-plans:progress:off\s*-->/;

export function normalizeLabel(label) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Replace inline code spans with spaces, so their contents are not parsed. */
function blankInlineCode(line) {
  return line.replace(/(`+)(.+?)\1/g, (m) => ' '.repeat(m.length));
}

function parseFrontmatter(lines) {
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.findIndex((l, i) => i > 0 && (l.trim() === '---' || l.trim() === '...'));
  if (end === -1) return { data: null, error: 'frontmatter is not closed', start: 0, end: 0 };
  const source = lines.slice(1, end).join('\n');
  try {
    const data = YAML.parse(source) ?? {};
    if (typeof data !== 'object' || Array.isArray(data)) {
      return { data: null, error: 'frontmatter is not a map', start: 0, end };
    }
    return { data, error: null, start: 0, end };
  } catch (err) {
    return { data: null, error: `invalid YAML: ${err.message.split('\n')[0]}`, start: 0, end };
  }
}

/**
 * Parse one Markdown file into the facts that the model needs.
 * Line numbers in the result are 0-based.
 */
export function parseMarkdown(file, text) {
  const lines = text.split('\n');
  const frontmatter = parseFrontmatter(lines);
  const bodyStart = frontmatter ? frontmatter.end + 1 : 0;

  const result = {
    file,
    text,
    lines,
    frontmatter,
    bodyStart,
    firstHeading: null,
    tasks: [],
    refsUsed: [],
    refDefs: new Map(),
    unknownMarks: [],
    links: [],
    mermaid: [],
    generated: [],
    progressOff: false,
  };

  let fence = null; // { char, length, start, lang }
  let generated = null; // { name, start }
  const taskStack = [];

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];

    if (fence) {
      const m = line.match(FENCE);
      if (m && m[1][0] === fence.char && m[1].length >= fence.length && !m[2].trim()) {
        if (fence.lang === 'mermaid' && !generated) {
          result.mermaid.push({ start: fence.start, end: i, body: lines.slice(fence.start + 1, i).join('\n') });
        }
        fence = null;
      }
      continue;
    }

    if (generated) {
      const m = line.match(GEN_END);
      if (m && m[1] === generated.name) {
        result.generated.push({ name: generated.name, start: generated.start, end: i });
        generated = null;
      }
      continue;
    }

    const genStart = line.match(GEN_START);
    if (genStart) {
      generated = { name: genStart[1], start: i };
      continue;
    }
    if (PROGRESS_OFF.test(line)) result.progressOff = true;

    const fenceOpen = line.match(FENCE);
    if (fenceOpen) {
      fence = {
        char: fenceOpen[1][0],
        length: fenceOpen[1].length,
        start: i,
        lang: fenceOpen[2].trim().split(/\s+/)[0].toLowerCase(),
      };
      continue;
    }

    if (!line.trim()) continue;

    const heading = line.match(HEADING);
    if (heading && !result.firstHeading) {
      result.firstHeading = { line: i, level: heading[1].length, text: heading[2] };
    }

    const def = line.match(REF_DEF);
    if (def) {
      result.refDefs.set(normalizeLabel(def[1]), { line: i, target: def[2] });
      continue;
    }

    const indent = line.match(/^\s*/)[0].replace(/\t/g, '    ').length;
    let task = line.match(TASK);
    let scanLine = line;
    if (task && !(task[2] in MARK_STATES)) {
      result.unknownMarks.push({ line: i, mark: task[2] });
      task = null;
    }
    if (task) {
      while (taskStack.length && taskStack.at(-1).indent >= indent) taskStack.pop();
      const parent = taskStack.at(-1);
      const markState = MARK_STATES[task[2]];
      const blocked = (markState === 'todo' || markState === 'doing') && BLOCKED_TAG.test(task[3]);
      const entry = {
        line: i,
        indent,
        mark: task[2],
        markState,
        state: blocked ? 'blocked' : markState,
        text: task[3].trim(),
        parent: parent ? parent.index : null,
        children: [],
      };
      entry.index = result.tasks.length;
      if (parent) result.tasks[parent.index].children.push(entry.index);
      result.tasks.push(entry);
      taskStack.push({ indent, index: entry.index });
      // Blank the mark so that `[x]` is not read as a reference.
      const markAt = line.indexOf(`[${task[2]}]`);
      scanLine = line.slice(0, markAt) + '   ' + line.slice(markAt + 3);
    } else if (LIST_ITEM.test(line) || indent <= (taskStack.at(-1)?.indent ?? -1)) {
      while (taskStack.length && taskStack.at(-1).indent >= indent) taskStack.pop();
    }

    scanInline(blankInlineCode(scanLine), i, result);
  }

  return result;
}

function scanInline(line, lineNo, result) {
  let rest = line;

  // Inline links and images: [text](target)
  rest = rest.replace(/!?\[([^\]]*)\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g, (m, _text, target) => {
    result.links.push({ line: lineNo, target: target.replace(/^<|>$/g, '') });
    return ' '.repeat(m.length);
  });

  // Full and collapsed references: [text][label], [label][]
  rest = rest.replace(/\[([^\]]*)\]\[([^\]]*)\]/g, (m, text, label) => {
    const kind = label ? 'full' : 'collapsed';
    result.refsUsed.push({ line: lineNo, label: normalizeLabel(label || text), raw: label || text, text, kind });
    return ' '.repeat(m.length);
  });

  // Shortcut references: [label] not followed by ( [ or :
  rest.replace(/(?<!\\)\[([^\][]+)\](?![[(:])/g, (m, label) => {
    if (label.startsWith('^')) return m; // footnote
    result.refsUsed.push({ line: lineNo, label: normalizeLabel(label), raw: label, text: label, kind: 'shortcut' });
    return m;
  });
}

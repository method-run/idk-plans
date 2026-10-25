// Join prose that is wrapped by hand (SPEC.md 6.3).
// It only joins lines that Markdown already joins with a soft break, so the
// rendered output does not change. When it is not sure, it leaves the line.

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const LIST = /^\s*([-*+]|\d{1,9}[.)])(\s|$)/;
// Lines that start a block of their own: headings, tables, HTML, link
// definitions, thematic breaks, setext underlines, and quotes.
const STARTER = /^\s*(#{1,6}(\s|$)|\||<|\[[^\]]+\]:\s|(\*\s*){3,}$|(-\s*){3,}$|(_\s*){3,}$|=+\s*$|>)/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const INDENTED = /^( {4}|\t)/;
const CALLOUT = /^\[![\w-]+\]/;

const hardBreak = (line) => line.endsWith('  ') || line.endsWith('\\');

/**
 * Unwrap hand-wrapped paragraphs, list items, and quotes.
 * Returns the new text and the 0-based source lines where a wrapped block starts.
 */
export function unwrapProse(text) {
  const lines = text.split('\n');
  const out = [];
  const from = []; // source line of each output line
  const wrapped = new Set();
  let i = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, k) => k > 0 && (l.trim() === '---' || l.trim() === '...'));
    if (end !== -1) {
      for (; i <= end; i++) { out.push(lines[i]); from.push(i); }
    }
  }
  const keep = (line) => { out.push(line); from.push(i); };
  const join = (body) => {
    out[out.length - 1] = `${out[out.length - 1].trimEnd()} ${body}`;
    wrapped.add(from[from.length - 1]);
  };

  let fence = null;
  let last = null; // 'para' | 'item' | 'quote' | 'table' | 'verbatim' | null
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      keep(line);
      const m = FENCE.exec(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !m[2].trim()) fence = null;
      continue;
    }
    const m = FENCE.exec(line);
    if (m) { fence = m[1]; keep(line); last = null; continue; }
    if (!line.trim()) { keep(line); last = null; continue; }

    const prev = out[out.length - 1] ?? '';
    const hard = hardBreak(prev);
    const stripped = line.trim();

    // Indented code after a blank line, or a nested block we cannot be sure of.
    if (last === 'verbatim' || (last === null && INDENTED.test(line) && !LIST.test(line))) {
      keep(line); last = 'verbatim'; continue;
    }
    if (TABLE_DELIMITER.test(line) && line.includes('|')) { keep(line); last = 'table'; continue; }
    if (last === 'table' && line.includes('|')) { keep(line); continue; }

    if (stripped.startsWith('>')) {
      const body = stripped.slice(1).trim();
      const plain = body && !STARTER.test(body) && !LIST.test(body) && !FENCE.test(body);
      if (last === 'quote' && !hard && plain && prev.trim() !== '>') join(body);
      else keep(line);
      // A callout title is a line of its own: do not join the body to it.
      last = CALLOUT.test(body) ? 'callout' : body ? 'quote' : null;
      continue;
    }
    if (LIST.test(line)) { keep(line); last = 'item'; continue; }
    if (STARTER.test(line)) { keep(line); last = null; continue; }
    if ((last === 'para' || last === 'item') && !hard) join(stripped);
    else { keep(line); last = 'para'; }
  }
  return { text: out.join('\n'), wrapped: [...wrapped].sort((a, b) => a - b) };
}

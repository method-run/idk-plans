// Problems as text. The command line and `serve` show problems in the same words.

export const LABELS = { error: 'error', warn: 'warning', info: 'info' };

/** Where a problem is, and what it is: `README.md:1  summary is required  [bad-field]`. */
export function problemText(p) {
  const where = p.file ? `${p.file}${p.line ? `:${p.line}` : ''}` : '(project)';
  return `${where}  ${p.message}  [${p.rule}]`;
}

/** `1 error, 2 warnings, 0 info` */
export function countText(problems) {
  const count = (s) => problems.filter((p) => p.severity === s).length;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(count('error'), 'error')}, ${plural(count('warn'), 'warning')}, ${count('info')} info`;
}

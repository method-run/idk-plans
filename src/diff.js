// A short line diff, so `fix --dry-run` can show what would change.

/**
 * Compare two texts line by line.
 * Returns hunks of changed lines with `context` unchanged lines around them.
 */
export function diffLines(before, after, context = 1) {
  const a = before.split('\n');
  const b = after.split('\n');
  // Skip the common start and end, so the table only covers the changed middle.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);

  // Longest common subsequence of the middle.
  const lcs = Array.from({ length: x.length + 1 }, () => new Uint32Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Each op is [mark, text, line in `before`].
  const ops = a.slice(0, start).map((text, k) => [' ', text, k + 1]);
  let i = 0;
  let j = 0;
  while (i < x.length || j < y.length) {
    const line = start + i + 1;
    if (i < x.length && j < y.length && x[i] === y[j]) { ops.push([' ', x[i], line]); i++; j++; }
    else if (i < x.length && (j === y.length || lcs[i + 1][j] >= lcs[i][j + 1])) { ops.push(['-', x[i], line]); i++; }
    else { ops.push(['+', y[j], line]); j++; }
  }
  for (let k = endA; k < a.length; k++) ops.push([' ', a[k], k + 1]);

  const keep = ops.map(() => false);
  ops.forEach(([mark], k) => {
    if (mark === ' ') return;
    for (let d = -context; d <= context; d++) if (ops[k + d]) keep[k + d] = true;
  });
  const out = [];
  let gap = true;
  ops.forEach(([mark, text, line], k) => {
    if (!keep[k]) { gap = true; return; }
    if (gap) out.push(`@@ line ${line} @@`);
    gap = false;
    out.push(`${mark} ${text}`);
  });
  return out;
}

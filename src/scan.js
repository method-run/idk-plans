import { readdir } from 'node:fs/promises';
import path from 'node:path';
import picomatch from 'picomatch';

/**
 * Find the Markdown files that the configuration includes.
 * Returns paths relative to cwd, with forward slashes, sorted.
 */
export async function scanFiles(cwd, config) {
  const wantsDotDirs = config.include.some((p) => p.startsWith('.') || p.includes('/.'));
  const isIncluded = picomatch(config.include, { dot: wantsDotDirs });
  const isExcluded = picomatch(config.exclude, { dot: true });
  const found = [];

  async function walk(relDir) {
    const entries = await readdir(path.join(cwd, relDir), { withFileTypes: true });
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') && !wantsDotDirs) continue;
        if (isExcluded(`${rel}/`) || isExcluded(`${rel}/x`)) continue;
        await walk(rel);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (isIncluded(rel) && !isExcluded(rel)) found.push(rel);
      }
    }
  }

  await walk('');
  return found.sort();
}

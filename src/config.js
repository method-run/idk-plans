import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const CONFIG_FILE = 'idk-plans.config.json';

export const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.git/**',
];

// Rule name → [severity, option?]. See SPEC.md section 10.
export const DEFAULT_RULES = {
  'frontmatter': 'error',
  'duplicate-id': 'error',
  'missing-parent': 'error',
  'no-primary-parent': 'error',
  'cycle': 'error',
  'path-mismatch': 'error',
  'unknown-tree': 'error',
  'broken-ref': 'error',
  'broken-link': 'error',
  'missing-code': 'error',
  'stale-generated': 'error',
  'bad-status': 'error',
  'task-parent-mismatch': 'warn',
  'unknown-mark': 'warn',
  'summary-max-words': ['warn', 25],
  'plan-finished': 'warn',
  'unlinked-child': 'warn',
  'orphan-file': 'info',
  'no-progress': 'info',
};

/** Normalize a rule setting to { severity, option }. */
export function ruleSetting(value) {
  if (Array.isArray(value)) return { severity: value[0], option: value[1] };
  return { severity: value, option: undefined };
}

/**
 * Load the project configuration, filling in defaults.
 * Throws when the file exists but is invalid.
 */
export async function loadConfig(cwd) {
  let raw = {};
  try {
    raw = JSON.parse(await readFile(path.join(cwd, CONFIG_FILE), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`${CONFIG_FILE}: ${err.message}`);
  }
  return resolveConfig(raw);
}

export function resolveConfig(raw = {}) {
  const trees = raw.trees && Object.keys(raw.trees).length
    ? raw.trees
    : { system: { title: 'System', primary: true } };
  const primaries = Object.keys(trees).filter((name) => trees[name].primary);
  if (primaries.length !== 1) {
    throw new Error(`${CONFIG_FILE}: exactly one tree must have "primary": true (found ${primaries.length})`);
  }
  const rules = { ...DEFAULT_RULES, ...(raw.rules ?? {}) };
  return {
    include: raw.include ?? ['**/*.md'],
    exclude: [...DEFAULT_EXCLUDE, ...(raw.exclude ?? [])],
    root: raw.root ?? null,
    trees,
    primaryTree: primaries[0],
    tags: raw.tags ?? true,
    site: raw.site ?? {},
    rules,
  };
}

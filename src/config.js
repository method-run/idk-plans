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

// Problems that stop pages from being built. They are always errors, and every
// command that builds from the model stops on them. See SPEC.md section 10.
export const ERROR_RULES = ['no-root', 'frontmatter', 'duplicate-id'];

// Every other rule: rule name → [severity, option?]. A project can make each one
// warn, info, or off, but not error. `check --strict` fails on warnings.
export const DEFAULT_RULES = {
  'bad-field': 'warn',
  'missing-parent': 'warn',
  'no-primary-parent': 'warn',
  'cycle': 'warn',
  'path-mismatch': 'warn',
  'unknown-tree': 'warn',
  'broken-ref': 'warn',
  'broken-link': 'warn',
  'missing-code': 'warn',
  'stale-generated': 'warn',
  'bad-status': 'warn',
  'task-parent-mismatch': 'warn',
  'unknown-mark': 'warn',
  'hard-wrap': 'warn',
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

function siteConfig(site) {
  if (site.theme != null && (typeof site.theme !== 'string' || !site.theme.trim())) {
    throw new Error(`${CONFIG_FILE}: "site.theme" must be the path of a themetron CSS theme`);
  }
  if (site.looks != null && (typeof site.looks !== 'string' || !site.looks.trim())) {
    throw new Error(`${CONFIG_FILE}: "site.looks" must be the path of themetron's looks.css`);
  }
  return site;
}

export function resolveConfig(raw = {}) {
  const trees = raw.trees && Object.keys(raw.trees).length
    ? raw.trees
    : { system: { title: 'System', primary: true } };
  const primaries = Object.keys(trees).filter((name) => trees[name].primary);
  if (primaries.length !== 1) {
    throw new Error(`${CONFIG_FILE}: exactly one tree must have "primary": true (found ${primaries.length})`);
  }
  for (const [rule, value] of Object.entries(raw.rules ?? {})) {
    if (ERROR_RULES.includes(rule)) {
      throw new Error(`${CONFIG_FILE}: rule "${rule}" can not be changed, because pages can not be built while it fails`);
    }
    if (ruleSetting(value).severity === 'error') {
      throw new Error(`${CONFIG_FILE}: rule "${rule}" can not be "error"; only problems that stop pages from being built are errors. To fail on warnings, use \`check --strict\``);
    }
  }
  const rules = { ...DEFAULT_RULES, ...(raw.rules ?? {}), ...Object.fromEntries(ERROR_RULES.map((r) => [r, 'error'])) };
  const proseWrap = raw.proseWrap ?? 'never';
  if (!['never', 'preserve'].includes(proseWrap)) {
    throw new Error(`${CONFIG_FILE}: "proseWrap" must be "never" or "preserve"`);
  }
  return {
    include: raw.include ?? ['**/*.md'],
    exclude: [...DEFAULT_EXCLUDE, ...(raw.exclude ?? [])],
    root: raw.root ?? null,
    trees,
    primaryTree: primaries[0],
    tags: raw.tags ?? true,
    proseWrap,
    site: siteConfig(raw.site ?? {}),
    rules,
  };
}

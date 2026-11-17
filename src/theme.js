import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The themes that the site reads: a stylesheet from idk-themetron, in its "css" format (the
// tokens only), or its "stylesheet" format (the tokens and its components; the site does not use
// the components). Made with the default token prefix (tm) and class prefix (theme-).
// The site reads the tokens of this version of themetron's token contract. A theme for another
// version stops the build, so a theme never half works. A theme without the "token contract"
// line, from before themetron 0.2.1, is read as this version.
export const THEMETRON_CONTRACT = '0.2.0';
export const THEMETRON_MANIFEST_URL = `https://method-run.github.io/idk-themetron/schema/${THEMETRON_CONTRACT}/tokens.manifest.json`;

/** The part of a version that a breaking change raises: the minor version before 1.0, then the major. */
function breakingPart(version) {
  const [major, minor] = version.split(/[.-]/).map(Number);
  return major === 0 ? `0.${minor}` : `${major}`;
}

// The colorways that the site uses, and the theme names that can give each one, first match
// first. The names and their other names are themetron's SEMANTIC_THEMES; "important" is for
// GitHub's IMPORTANT callouts, and a "secondary" theme can stand in for it.
export const COLORWAYS = {
  success: ['success', 'positive'],
  warning: ['warning', 'caution', 'attention', 'notice'],
  danger: ['danger', 'error', 'critical', 'negative', 'destructive'],
  info: ['info', 'information', 'informative'],
  important: ['important', 'secondary'],
};

/**
 * Read a themetron theme stylesheet (the "css" export). Returns its text, the theme class for
 * each colorway that the theme has, and whether it has the root class and icons.
 * Throws when the file is missing, or is not a themetron theme.
 */
export async function readTheme(cwd, file) {
  const full = path.resolve(cwd, file);
  let css;
  try {
    css = await readFile(full, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`site.theme: ${file} does not exist`);
    throw err;
  }
  if (!/--tm-bg-canvas\s*:/.test(css)) {
    const other = css.match(/--([a-z][a-z0-9]*)-bg-canvas\s*:/);
    throw new Error(other
      ? `site.theme: ${file} uses the token prefix "${other[1]}"; export it again with the default prefix, tm`
      : `site.theme: ${file} is not a themetron theme (it sets no --tm-* tokens); export the theme with the "css" format`);
  }
  const contract = css.match(/token contract (\d+\.\d+\.\d+[\w.-]*)/)?.[1] ?? null;
  if (contract && breakingPart(contract) !== breakingPart(THEMETRON_CONTRACT)) {
    throw new Error(`site.theme: ${file} was made for themetron token contract ${contract}, but idk-plans reads contract ${breakingPart(THEMETRON_CONTRACT)}.x (${THEMETRON_MANIFEST_URL}); export the theme with a themetron version for that contract, or update idk-plans`);
  }
  const names = new Set([...css.matchAll(/\.theme-([a-z0-9]+(?:-[a-z0-9]+)*)/g)].map((m) => m[1]));
  const classes = {};
  for (const [colorway, candidates] of Object.entries(COLORWAYS)) {
    const name = candidates.find((n) => names.has(n));
    if (name) classes[colorway] = `theme-${name}`;
  }
  return {
    file: full,
    css,
    contract,
    classes,
    root: names.has('default') ? 'theme-default' : null,
    icons: /--tm-font-icon\s*:/.test(css),
  };
}

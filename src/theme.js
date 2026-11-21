import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The themes that the site reads: a stylesheet from idk-themetron, in its "css" format (the
// tokens only), its "looks" format (the tokens and the tm-look-* classes, which the site then
// wears), or its "stylesheet" format (the tokens, the looks, and the components; the site does
// not use the components). Made with the default token prefix (tm) and class prefix (theme-).
// The site reads these versions of themetron's token contract. Each added tokens and changed
// none that the site reads, so they all work. A theme for another version stops the build, so a
// theme never half works. A theme without the "token contract" line, from before themetron
// 0.2.1, is read as 0.2. 0.4 adds the looks to the manifest; its manifest is not out yet.
export const THEMETRON_CONTRACTS = ['0.2', '0.3', '0.4'];
// The newest contract with a published manifest, for links.
export const THEMETRON_CONTRACT = '0.3.0';
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
 * Read themetron's looks.css (site.looks): the tm-look-* classes, the same for every theme.
 * Throws when the file is missing, or has no looks.
 */
export async function readLooks(cwd, file) {
  let css;
  try {
    css = await readFile(path.resolve(cwd, file), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`site.looks: ${file} does not exist`);
    throw err;
  }
  if (!/\.tm-look-fill\b/.test(css)) throw new Error(`site.looks: ${file} is not themetron's looks.css (it has no tm-look-* classes)`);
  return { file: path.resolve(cwd, file), css };
}

/**
 * Read a themetron theme stylesheet (the "css" or "looks" export). Returns its text, the theme
 * class for each colorway that the theme has, and whether it has the root class, icons, and looks.
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
  if (contract && !THEMETRON_CONTRACTS.includes(breakingPart(contract))) {
    throw new Error(`site.theme: ${file} was made for themetron token contract ${contract}, but idk-plans reads contracts ${THEMETRON_CONTRACTS.map((v) => `${v}.x`).join(', ')} (${THEMETRON_MANIFEST_URL}); export the theme with a themetron version for one of them, or update idk-plans`);
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
    // The looks export, or the stylesheet export, which has the looks too.
    looks: /\.tm-look-fill\b/.test(css),
  };
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The themes that the site reads. The easy one is a themetron inputs file (.json), as the
// playground downloads it: the site builds the theme from it with themetron, and wears the
// looks of the same themetron. Themetron runs only here, at build time; the site gets CSS.
// The site also reads a stylesheet from idk-themetron, in its "css" format (the
// tokens only), its "looks" format (the tokens and the tm-look-* classes, which the site then
// wears), or its "stylesheet" format (the tokens, the looks, and the components; the site does
// not use the components). Made with the default token prefix (tm) and class prefix (theme-).
// The site reads these versions of themetron's token contract. Each added tokens and changed
// none that the site reads, so they all work. A theme for another version stops the build, so a
// theme never half works. A theme without the "token contract" line, from before themetron
// 0.2.1, is read as 0.2. 0.4 adds the looks to the manifest.
export const THEMETRON_CONTRACTS = ['0.2', '0.3', '0.4'];
// The newest contract, for links.
export const THEMETRON_CONTRACT = '0.4.0';
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

/** True for a themetron inputs file, which the site builds into a theme. */
export const isInputs = (file) => /\.json$/i.test(file);

// Themetron is loaded only for an inputs file, so a site without one never loads it.
const themetron = () => import('@method-run/idk-themetron');

/** Build the tokens ("css" format) from a themetron inputs file. */
async function buildFromInputs(full, file) {
  let inputs;
  try {
    inputs = JSON.parse(await readFile(full, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`site.theme: ${file} does not exist`);
    throw new Error(`site.theme: ${file} is not a themetron inputs file: ${err.message}`);
  }
  const { buildThemes, toCss } = await themetron();
  try {
    return toCss(buildThemes(inputs));
  } catch (err) {
    throw new Error(`site.theme: ${file}: ${err.message}`);
  }
}

/**
 * The looks of the installed themetron. The looks of an inputs theme come from here, so the
 * tokens and the looks are from one version.
 */
export async function packageLooks() {
  const file = fileURLToPath(import.meta.resolve('@method-run/idk-themetron/looks.css'));
  return { file, css: await readFile(file, 'utf8') };
}

/**
 * Read a themetron theme: an inputs file (.json), which it builds, or a stylesheet (the "css" or
 * "looks" export). Returns its CSS, the theme class for each colorway that the theme has, and
 * whether it has the root class, icons, and looks, and was built from inputs.
 * Throws when the file is missing, or is not a themetron theme.
 */
export async function readTheme(cwd, file) {
  const full = path.resolve(cwd, file);
  let css;
  if (isInputs(file)) {
    css = await buildFromInputs(full, file);
  } else {
    try {
      css = await readFile(full, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error(`site.theme: ${file} does not exist`);
      throw err;
    }
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
    inputs: isInputs(file),
  };
}

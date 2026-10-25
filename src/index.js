import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.js';
import { scanFiles } from './scan.js';
import { parseMarkdown } from './parse.js';
import { buildModel, toJSON } from './model.js';
import { fixDocument, firstDifference, rollupText } from './fix.js';
import { ruleSetting } from './config.js';
import { unwrapProse } from './wrap.js';

export { buildModel, toJSON, parseMarkdown, fixDocument, rollupText, unwrapProse };
export { buildSite } from './site.js';
export { initProject } from './init.js';

/** Read, parse, and model a project. */
export async function loadProject(cwd) {
  const config = await loadConfig(cwd);
  const files = await scanFiles(cwd, config);
  const parsed = await Promise.all(files.map(async (file) => (
    parseMarkdown(file, await readFile(path.join(cwd, file), 'utf8'))
  )));
  const exists = (rel) => existsSync(path.join(cwd, rel));
  const model = buildModel({ config, parsed, exists });
  return { cwd, config, model };
}

/** All problems, including stale generated blocks. */
export function check(project) {
  const { model, config } = project;
  const problems = [...model.problems];
  const { severity } = ruleSetting(config.rules['stale-generated']);
  if (severity !== 'off') {
    for (const node of model.nodes.values()) {
      if (!node.doc) continue;
      const fixed = fixDocument(model, node, { blocks: true, marks: false, aliases: false });
      if (fixed !== node.doc.text) {
        problems.push({
          rule: 'stale-generated',
          severity,
          file: node.file,
          line: firstDifference(node.doc.text, fixed),
          message: 'generated content is not current; run `idk-plans fix`',
        });
      }
    }
  }
  const wrap = ruleSetting(config.rules['hard-wrap']);
  if (wrap.severity !== 'off' && config.proseWrap !== 'preserve') {
    for (const node of model.nodes.values()) {
      if (!node.doc) continue;
      for (const line of unwrapProse(node.doc.text).wrapped) {
        problems.push({
          rule: 'hard-wrap',
          severity: wrap.severity,
          file: node.file,
          line: line + 1,
          message: 'text is wrapped across lines; run `idk-plans fix` (6.3)',
        });
      }
    }
  }
  const order = { error: 0, warn: 1, info: 2 };
  return problems.sort((a, b) => (
    order[a.severity] - order[b.severity]
    || (a.file ?? '').localeCompare(b.file ?? '')
    || (a.line ?? 0) - (b.line ?? 0)
  ));
}

/** The fixes, without writing them: { file, before, after } for each file that would change. */
export function planFixes(project) {
  const plans = [];
  for (const node of project.model.nodes.values()) {
    if (!node.doc) continue;
    const after = fixDocument(project.model, node);
    if (after !== node.doc.text) plans.push({ file: node.file, before: node.doc.text, after });
  }
  return plans;
}

/** Write fixes to disk. Returns the files that changed. */
export async function fix(project) {
  const plans = planFixes(project);
  for (const { file, after } of plans) await writeFile(path.join(project.cwd, file), after);
  return plans.map((p) => p.file);
}

/** A tree as text lines, for the terminal. */
export function renderTree(model, treeName = model.primary, maxDepth = Infinity) {
  const tree = model.trees[treeName];
  if (!tree) throw new Error(`unknown tree "${treeName}"`);
  const lines = [];
  const label = (id) => {
    const node = model.nodes.get(id);
    const badge = rollupText(node?.rollup?.[treeName]);
    const name = node?.virtual ? `${node.title} (virtual)` : node?.title ?? id;
    return `${name} [${id}]${badge ? `  ${badge}` : ''}`;
  };
  lines.push(label(tree.top));
  const walk = (id, prefix, depth, seen) => {
    if (depth >= maxDepth) return;
    const kids = tree.children.get(id) ?? [];
    kids.forEach((kid, i) => {
      const last = i === kids.length - 1;
      lines.push(`${prefix}${last ? '└─ ' : '├─ '}${label(kid)}`);
      if (!seen.has(kid)) walk(kid, `${prefix}${last ? '   ' : '│  '}`, depth + 1, new Set([...seen, kid]));
    });
  };
  walk(tree.top, '', 0, new Set([tree.top]));
  return lines;
}

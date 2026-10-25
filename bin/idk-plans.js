#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { loadProject, check, fix, planFixes, renderTree, toJSON } from '../src/index.js';
import { buildSite } from '../src/site.js';
import { initProject } from '../src/init.js';
import { diffLines } from '../src/diff.js';

const USAGE = `Usage: idk-plans <command> [options]

Commands:
  init               Write starter files that do not exist yet.
  check              Report problems. Exits 1 if there is an error.
  fix                Write generated blocks and correct what can be corrected.
  tree               Show a tree with progress.
  model              Print the model as JSON.
  site               Build the static site.

Options:
  --cwd <dir>        Project root (default: current directory)
  --ci <host>        Add a workflow that publishes the site: github or gitlab (init command)
  --hooks            Add git hooks in .githooks/ (init command)
  --dry-run          Show what would change, and write nothing (fix command)
  --tree <name>      Tree to show (tree command; default: the primary tree)
  --depth <n>        Depth to show (tree command)
  --quiet            Show only errors (check command)
  --out <dir>        Output folder (site command; default: _site)
  --source-url <url> Base URL for links to files in the repository (site command)
  --help             Show this message
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cwd: { type: 'string' },
    ci: { type: 'string' },
    hooks: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
    tree: { type: 'string' },
    depth: { type: 'string' },
    quiet: { type: 'boolean' },
    out: { type: 'string' },
    'source-url': { type: 'string' },
    help: { type: 'boolean' },
  },
});

const command = positionals[0];
if (values.help || !command) {
  process.stdout.write(USAGE);
  process.exit(command || values.help ? 0 : 1);
}

const cwd = values.cwd ?? process.cwd();

function printProblems(problems) {
  const icon = { error: '✖', warn: '⚠', info: 'ℹ' };
  for (const p of problems) {
    const where = p.file ? `${p.file}${p.line ? `:${p.line}` : ''}` : '(project)';
    console.log(`${icon[p.severity]} ${where}  ${p.message}  [${p.rule}]`);
  }
  const count = (s) => problems.filter((p) => p.severity === s).length;
  console.log(`\n${count('error')} errors, ${count('warn')} warnings, ${count('info')} info`);
}

async function init() {
  const results = await initProject(cwd, { ci: values.ci, hooks: values.hooks });
  for (const { file, action } of results) console.log(`${action.padEnd(8)} ${file}`);
  // Fill the generated blocks of the new files.
  const changed = await fix(await loadProject(cwd));
  for (const file of changed) console.log(`fixed    ${file}`);
  if (values.hooks) console.log('\nTurn on the hooks with: git config core.hooksPath .githooks');
  if (values.ci === 'github') console.log('\nIn the repository settings, open Pages, and set Source to GitHub Actions.');
}

try {
  if (command === 'init') {
    await init();
    process.exit(0);
  }
  const project = await loadProject(cwd);
  switch (command) {
    case 'check': {
      let problems = check(project);
      if (values.quiet) problems = problems.filter((p) => p.severity === 'error');
      printProblems(problems);
      process.exit(problems.some((p) => p.severity === 'error') ? 1 : 0);
      break;
    }
    case 'fix': {
      if (values['dry-run']) {
        const plans = planFixes(project);
        for (const { file, before, after } of plans) {
          console.log(`would fix ${file}`);
          for (const line of diffLines(before, after)) console.log(`  ${line}`);
        }
        console.log(`\n${plans.length} files would change`);
        break;
      }
      const changed = await fix(project);
      for (const file of changed) console.log(`fixed ${file}`);
      const after = check(await loadProject(cwd));
      printProblems(after.filter((p) => p.severity !== 'info'));
      process.exit(after.some((p) => p.severity === 'error') ? 1 : 0);
      break;
    }
    case 'tree': {
      const depth = values.depth ? Number(values.depth) : Infinity;
      console.log(renderTree(project.model, values.tree, depth).join('\n'));
      break;
    }
    case 'site': {
      const out = path.resolve(cwd, values.out ?? '_site');
      const pages = await buildSite(project, out, values['source-url'] ? { sourceUrl: values['source-url'] } : {});
      console.log(`wrote ${pages.length} pages to ${path.relative(process.cwd(), out) || '.'}`);
      break;
    }
    case 'model':
      process.stdout.write(`${JSON.stringify(toJSON(project.model), null, 2)}\n`);
      break;
    default:
      process.stderr.write(`Unknown command "${command}"\n\n${USAGE}`);
      process.exit(1);
  }
} catch (err) {
  console.error(`idk-plans: ${err.message}`);
  process.exit(2);
}

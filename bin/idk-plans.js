#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadProject, check, fix, renderTree, toJSON } from '../src/index.js';

const USAGE = `Usage: idk-plans <command> [options]

Commands:
  check              Report problems. Exits 1 if there is an error.
  fix                Write generated blocks and correct what can be corrected.
  tree               Show a tree with progress.
  model              Print the model as JSON.

Options:
  --cwd <dir>        Project root (default: current directory)
  --tree <name>      Tree to show (tree command; default: the primary tree)
  --depth <n>        Depth to show (tree command)
  --quiet            Show only errors (check command)
  --help             Show this message
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cwd: { type: 'string' },
    tree: { type: 'string' },
    depth: { type: 'string' },
    quiet: { type: 'boolean' },
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

try {
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

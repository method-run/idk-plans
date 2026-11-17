#!/usr/bin/env node
import { parseArgs, styleText } from 'node:util';
import path from 'node:path';
import { loadProject, check, checkBuild, fix, planFixes, renderTree, toJSON } from '../src/index.js';
import { buildSite } from '../src/site.js';
import { serveSite } from '../src/serve.js';
import { initProject } from '../src/init.js';
import { diffLines } from '../src/diff.js';
import { LABELS, problemText, countText } from '../src/problems.js';

const USAGE = `Usage: idk-plans <command> [options]

Commands:
  init               Write starter files that do not exist yet.
  check              Report problems. Exits 1 if there is an error (or a warning, with --strict).
  fix                Write generated blocks and correct what can be corrected.
  tree               Show a tree with progress.
  model              Print the model as JSON.
  site               Build the static site.
  serve              Serve the site, and rebuild and reload it when a file changes.

Options:
  --cwd <dir>        Project root (default: current directory)
  --ci <host>        Add a workflow that publishes the site: github or gitlab (init command)
  --hooks            Add git hooks in .githooks/ (init command)
  --dry-run          Show what would change, and write nothing (fix command)
  --tree <name>      Tree to show (tree command; default: the primary tree)
  --depth <n>        Depth to show (tree command)
  --strict           Fail on warnings too (check and fix commands)
  --quiet            Show only the problems that make the command fail (check command)
  --out <dir>        Output folder (site command; default: _site)
  --source-url <url> Base URL for links to files in the repository (site and serve commands)
  --port <n>         Port (serve command; default: 4747)
  --host <host>      Host (serve command; default: 127.0.0.1)
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
    strict: { type: 'boolean' },
    quiet: { type: 'boolean' },
    out: { type: 'string' },
    'source-url': { type: 'string' },
    port: { type: 'string' },
    host: { type: 'string' },
    help: { type: 'boolean' },
  },
});

const command = positionals[0];
if (values.help || !command) {
  process.stdout.write(USAGE);
  process.exit(command || values.help ? 0 : 1);
}

const cwd = values.cwd ?? process.cwd();
// Options of site and serve that override "site" in the configuration.
const siteOptions = values['source-url'] ? { sourceUrl: values['source-url'] } : {};

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (format, text) => (color ? styleText(format, text) : text);
const STYLES = { error: 'red', warn: 'yellow', info: 'dim' };
const ICONS = { error: '✖', warn: '⚠', info: 'ℹ' };

function printProblems(problems) {
  for (const p of problems) {
    const label = paint(STYLES[p.severity], `${ICONS[p.severity]} ${LABELS[p.severity].padEnd(7)}`);
    console.log(`${label} ${problemText(p)}`);
  }
  console.log(`\n${countText(problems)}`);
}

/** The problems that make check and fix fail: errors, and warnings with --strict. */
const failing = (problems) => problems.filter((p) => p.severity === 'error' || (values.strict && p.severity === 'warn'));

/** Stop a command that builds from the model when there is an error. Same text as check. */
function stopOnErrors(project) {
  const { errors, warnings } = checkBuild(project);
  if (errors.length) {
    printProblems(errors);
    console.log(`idk-plans ${command} stopped: fix the errors above, then run it again`);
    process.exit(1);
  }
  return warnings;
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
  if (command === 'serve') {
    const server = await serveSite(cwd, {
      port: values.port ? Number(values.port) : undefined,
      host: values.host,
      siteOptions,
      log: (message) => console.log(message),
    });
    console.log(`serving ${server.url}\nwatching ${path.relative(process.cwd(), cwd) || '.'} for changes; press Ctrl+C to stop`);
    const stop = async () => { await server.close(); process.exit(0); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    await new Promise(() => {});
  }
  const project = await loadProject(cwd);
  switch (command) {
    case 'check': {
      const problems = check(project);
      printProblems(values.quiet ? failing(problems) : problems);
      process.exit(failing(problems).length ? 1 : 0);
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
      process.exit(failing(after).length ? 1 : 0);
      break;
    }
    case 'tree': {
      stopOnErrors(project);
      const depth = values.depth ? Number(values.depth) : Infinity;
      console.log(renderTree(project.model, values.tree, depth).join('\n'));
      break;
    }
    case 'site': {
      const warnings = stopOnErrors(project);
      const out = path.resolve(cwd, values.out ?? '_site');
      const pages = await buildSite(project, out, siteOptions);
      console.log(`wrote ${pages.length} pages to ${path.relative(process.cwd(), out) || '.'}`);
      if (warnings.length) {
        console.log();
        printProblems(warnings);
      }
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

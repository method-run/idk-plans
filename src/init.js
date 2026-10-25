// Write starter files for a new project. It never changes a file that exists,
// except to add `_site/` to .gitignore.
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_FILE } from './config.js';

// These must match the workflows in docs/publish-site.md. A test checks this.
export const CI_TEMPLATES = {
  github: {
    file: '.github/workflows/pages.yml',
    text: `name: Docs site

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: '22'

      - run: npm ci

      - run: npx idk-plans check --quiet

      - run: >-
          npx idk-plans site --out _site
          --source-url "\${{ github.server_url }}/\${{ github.repository }}/blob/\${{ github.sha }}"

      - uses: actions/upload-pages-artifact@v5
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
`,
  },
  gitlab: {
    file: '.gitlab-ci.yml',
    text: `image: node:22

pages:
  script:
    - npm ci
    - npx idk-plans check --quiet
    - npx idk-plans site --out public --source-url "$CI_PROJECT_URL/-/blob/$CI_COMMIT_SHA"
  artifacts:
    paths: [public]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
`,
  },
};

// These must match the hooks in README.md. A test checks this.
export const HOOK_TEMPLATES = {
  'pre-commit': `#!/bin/sh
# Update the generated parts, then add the files that fix changed.
out=$(npx idk-plans fix) || { echo "$out"; exit 1; }
echo "$out"
echo "$out" | sed -n 's/^fixed //p' | while read -r file; do git add -- "$file"; done
`,
  'pre-push': `#!/bin/sh
npx idk-plans check --quiet
`,
};

/** A valid node id from a package or folder name: "@scope/My App" → "my-app". */
export function idFromName(name) {
  const id = name.replace(/^@[^/]+\//, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return id || 'project';
}

async function projectName(cwd) {
  try {
    const { name } = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'));
    if (typeof name === 'string' && name) return name.replace(/^@[^/]+\//, '');
  } catch { /* no package.json: use the folder name */ }
  return path.basename(path.resolve(cwd));
}

const configText = (id) => `${JSON.stringify({
  $schema: './node_modules/@method-run/idk-plans/schema/config.schema.json',
  root: { file: 'README.md', id },
  trees: { system: { title: 'System', primary: true } },
}, null, 2)}\n`;

const readmeText = (title) => `# ${title}

<!-- idk-plans:progress:start (generated) -->
<!-- idk-plans:progress:end -->

Say what this project does, and who it is for.

## Parts

<!-- idk-plans:children:start (generated) -->
<!-- idk-plans:children:end -->
`;

/**
 * Write the starter files that do not exist yet.
 * options.ci: "github" or "gitlab", to add a workflow that publishes the site.
 * options.hooks: true, to add git hooks in .githooks/.
 * Returns [{ file, action }], where action is "created", "updated", or "skipped".
 */
export async function initProject(cwd, options = {}) {
  if (options.ci && !CI_TEMPLATES[options.ci]) {
    throw new Error(`--ci must be ${Object.keys(CI_TEMPLATES).map((k) => `"${k}"`).join(' or ')}`);
  }
  const name = await projectName(cwd);
  const results = [];
  const create = async (file, text, mode) => {
    const full = path.join(cwd, file);
    if (existsSync(full)) { results.push({ file, action: 'skipped' }); return; }
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, text);
    if (mode) await chmod(full, mode);
    results.push({ file, action: 'created' });
  };

  await create(CONFIG_FILE, configText(idFromName(name)));
  await create('README.md', readmeText(name));
  if (options.ci) await create(CI_TEMPLATES[options.ci].file, CI_TEMPLATES[options.ci].text);
  if (options.hooks) {
    for (const [hook, text] of Object.entries(HOOK_TEMPLATES)) await create(`.githooks/${hook}`, text, 0o755);
  }

  const ignore = path.join(cwd, '.gitignore');
  const current = existsSync(ignore) ? await readFile(ignore, 'utf8') : '';
  if (current.split('\n').some((line) => ['_site', '_site/', '/_site', '/_site/'].includes(line.trim()))) {
    results.push({ file: '.gitignore', action: 'skipped' });
  } else {
    await writeFile(ignore, `${current}${current && !current.endsWith('\n') ? '\n' : ''}_site/\n`);
    results.push({ file: '.gitignore', action: current ? 'updated' : 'created' });
  }
  return results;
}

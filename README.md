# idk-plans

<!-- idk-plans:progress:start (generated) -->
◐ 92% (39/42) · 4 deferred
<!-- idk-plans:progress:end -->

Keep your project's architecture and progress in Markdown files next to the code. idk-plans checks the files, keeps their generated parts current, and builds a website from them. Progress rolls up from tasks to the top of the project.

- **[Specification](./SPEC.md "spec")**: the format. Start here.
- **[How it works](./docs/how-it-works.md "how-it-works")**: what the tool does when you run a command, step by step.
- **Status:** 0.1.0 draft. The format can change.
- **AI use:** this project was made with the help of an AI coding assistant (Claude). AI wrote much of the code and the docs. The tool itself does not use AI.
- **Demo:** these docs use idk-plans. See them as a site at [method-run.github.io/idk-plans](https://method-run.github.io/idk-plans/), or run `npm run docs:site` to build it yourself.

```mermaid
flowchart LR
  you([You]) -->|write| files[(Markdown files)]
  spec[Specification] -.->|defines| files
  cli[Command line] -->|runs| engine[Engine]
  engine -->|checks and fixes| files
  files -->|read in any viewer| compatibility[Tested viewers]
```

<!-- idk-plans:zoom:start (generated) -->
Zoom in: [Specification](./SPEC.md "spec") · [Command line](./bin/README.md "cli") · [Engine](./src/README.md "engine") · [Tested viewers](./docs/compatibility.md "compatibility")
<!-- idk-plans:zoom:end -->

## What it does

- Each doc page has an `id` and a `parent`, so the pages make a tree.
- A page can also be in other trees, such as a "concerns" tree. It uses dot-separated paths: `parents: { concern: security.peer-auth }`.
- Tasks are checkboxes: `[ ]` todo, `[/]` doing, `[x]` done, `[>]` deferred, `[-]` or `[~]` dropped. `#blocked` on an open task makes it blocked. Progress rolls up through every tree.
- Links carry ids: `[Trust store](../trust/README.md "trust-store")`. You type `[trust-store]`, and the tool writes the path. It corrects the path when files move, so links work in any Markdown viewer without a site.
- Generated blocks show progress, child pages, and diagram links. The Markdown stays readable without the tool.
- `fix` writes each page's place in every tree as nested tags, and adds page titles to `aliases`, for viewers that use them.

## Parts

<!-- idk-plans:children:start (generated) -->
- [Specification](./SPEC.md "spec"): The format of idk-plans files. It defines nodes, trees, tasks, rollups, links, generated blocks, and the checks. · no tasks · 3 deferred
- [How it works](./docs/how-it-works.md "how-it-works"): What idk-plans does when you run a command, step by step. The tool is deterministic, and it does not use AI or the network.
- [Command line](./bin/README.md "cli"): Runs the commands check, fix, tree, model, and site. It is the only part that reads arguments and writes to the terminal. ● 100% (4/4)
- [Engine](./src/README.md "engine"): Reads the Markdown files, builds one model of all nodes, trees, and tasks, and checks and fixes the files from that model. ◐ 93% (27/29) · 1 deferred
- [Tested viewers](./docs/compatibility.md "compatibility"): The viewers that we test the Markdown files and the site with, and what each one shows differently. ● 100% (6/6)
- [Release a version](./docs/release.md "release"): How a maintainer releases a new version of idk-plans. A version tag starts a workflow that publishes to npm and makes a GitHub release.
<!-- idk-plans:children:end -->

## Other views

<!-- idk-plans:trees:start (generated) -->
**Viewers** ◐ 91% (22/24) · 1 deferred

- [Site builder](./src/site.md "site") ◐ 75% (6/8)
  - [Publish the site](./docs/publish-site.md "publish-site") ● 100% (2/2)
- Markdown ● 100% (12/12) · 1 deferred
  - [Tested viewers](./docs/compatibility.md "compatibility") ● 100% (6/6)
    - [Working in Obsidian](./obsidian/README.md "obsidian") ● 100% (3/3)
  - [Fix](./src/fix.md "fix") ● 100% (4/4)
  - [Prose unwrap](./src/wrap.md "wrap") ● 100% (2/2) · 1 deferred
- Terminal ● 100% (4/4)
  - [Command line](./bin/README.md "cli") ● 100% (4/4)
<!-- idk-plans:trees:end -->

## Use

```sh
npm install --save-dev @method-run/idk-plans

npx idk-plans init     # write a starter config and README
npx idk-plans init --ci github --hooks
npx idk-plans check    # report problems (CI, pre-push)
npx idk-plans fix      # update generated blocks (pre-commit)
npx idk-plans fix --dry-run
npx idk-plans tree     # show progress in the terminal
npx idk-plans tree --tree concern
npx idk-plans model    # the whole model as JSON
npx idk-plans site     # build the static site into _site/
```

To use it from code:

```js
import { loadProject, check, fix, buildSite } from '@method-run/idk-plans';

const project = await loadProject(process.cwd());
const problems = check(project);
await buildSite(project, '_site');
```

The configuration is `idk-plans.config.json` in the project root. See section 9 of the [Specification](./SPEC.md "spec").

## Git hooks

`idk-plans init --hooks` writes these two hooks.

`.githooks/pre-commit`:

```sh
#!/bin/sh
# Update the generated parts, then add the files that fix changed.
out=$(npx idk-plans fix) || { echo "$out"; exit 1; }
echo "$out"
echo "$out" | sed -n 's/^fixed //p' | while read -r file; do git add -- "$file"; done
```

`.githooks/pre-push`:

```sh
#!/bin/sh
npx idk-plans check --quiet
```

Turn them on with `git config core.hooksPath .githooks`.

## Site

`idk-plans site --out _site` builds a static site that any static host can serve. See [Publish the site](./docs/publish-site.md "publish-site").

## Tasks

- [x] Publish the repository
- [x] Publish the package on npm
- [ ] Publish version 1.0 of the format

## Tested with

We test the Markdown files in GitHub, GitLab, and Obsidian, and publish the site with GitHub Pages and GitLab Pages. See [Tested viewers](./docs/compatibility.md "compatibility").

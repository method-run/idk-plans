# idk-plans

<!-- idk-plans:progress:start (generated) -->
◐ 75% (28/37) · 5 deferred
<!-- idk-plans:progress:end -->

Keep your project's architecture and progress in Markdown files next to the code. idk-plans checks the files, keeps their generated parts current, and builds a website from them. Progress rolls up from tasks to the top of the project.

- **[Specification](./SPEC.md "spec")**: the format. Start here.
- **Status:** 0.1.0 draft. The format can change.
- **AI use:** this project was made with the help of an AI coding assistant (Claude). AI wrote much of the code and the docs.
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
- [Command line](./bin/README.md "cli"): Runs the commands check, fix, tree, model, and site. It is the only part that reads arguments and writes to the terminal. ◐ 66% (2/3)
- [Engine](./src/README.md "engine"): Reads the Markdown files, builds one model of all nodes, trees, and tasks, and checks and fixes the files from that model. ◐ 88% (22/25) · 1 deferred
- [Tested viewers](./docs/compatibility.md "compatibility"): The viewers that we test the Markdown files and the site with, and what each one shows differently. ◐ 66% (4/6) · 1 deferred
<!-- idk-plans:children:end -->

## Other views

<!-- idk-plans:trees:start (generated) -->
**Viewers** ◐ 72% (16/22) · 2 deferred

- [Site builder](./src/site.md "site") ◐ 57% (4/7)
  - [Publish the site](./docs/publish-site.md "publish-site") ○ 0% (0/2)
- Markdown ◐ 83% (10/12) · 2 deferred
  - [Tested viewers](./docs/compatibility.md "compatibility") ◐ 66% (4/6) · 1 deferred
    - [Working in Obsidian](./obsidian/README.md "obsidian") ● 100% (3/3)
  - [Fix](./src/fix.md "fix") ● 100% (4/4)
  - [Prose unwrap](./src/wrap.md "wrap") ● 100% (2/2) · 1 deferred
- Terminal ◐ 66% (2/3)
  - [Command line](./bin/README.md "cli") ◐ 66% (2/3)
<!-- idk-plans:trees:end -->

## Use

```sh
npm install --save-dev @method-run/idk-plans

npx idk-plans check    # report problems (CI, pre-push)
npx idk-plans fix      # update generated blocks (pre-commit)
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

```sh
# .githooks/pre-commit
npx idk-plans fix && git add -u

# .githooks/pre-push
npx idk-plans check --quiet
```

Turn them on with `git config core.hooksPath .githooks`.

## Site

`idk-plans site --out _site` builds a static site that any static host can serve. See [Publish the site](./docs/publish-site.md "publish-site").

## Tasks

- [ ] Publish the repository
- [ ] Publish the package on npm
- [ ] Publish version 1.0 of the format

## Tested with

We test the Markdown files in GitHub, Codeberg, and Obsidian, and publish the site with GitHub Pages and Codeberg Pages. See [Tested viewers](./docs/compatibility.md "compatibility").

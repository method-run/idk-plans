# idk-plans

Keep your project's architecture and progress in Markdown files next to the code. idk-plans checks them, keeps the generated parts current, and shows progress that rolls up from tasks to the top of the project.

- **[SPEC.md](SPEC.md)**: the format. Start here.
- **Status:** 0.1.0 draft. The format can change.

## What it does

- Each doc page has an `id` and a `parent`, so the pages make a tree.
- A page can also be in other trees, such as a "concerns" tree, with dot-separated paths: `parents: { concern: security.peer-auth }`.
- Tasks are checkboxes: `[ ]` todo, `[/]` doing, `[x]` done, `[>]` deferred, `[-]` dropped, and `#blocked` on an open task. Progress rolls up through every tree.
- Links carry ids (`[Trust store](../trust/README.md "trust-store")`). You can type `[trust-store]`; the tool writes the path, and fixes it when files move, so the links work on Codeberg, GitHub, and Obsidian without a site build.
- Generated blocks show progress, child pages, and diagram links. The Markdown stays readable without the tool.
- For Obsidian: `fix` writes each page's place in every tree as nested tags (`concern/security/peer-auth/trust-store`) and adds page titles to `aliases`.

## Use

```sh
npm install --save-dev idk-plans

npx idk-plans check    # report problems (CI, pre-push)
npx idk-plans fix      # update generated blocks (pre-commit)
npx idk-plans tree     # show progress in the terminal
npx idk-plans tree --tree concern
npx idk-plans model    # the whole model as JSON
npx idk-plans site     # build the static site into _site/
```

Configuration: `idk-plans.config.json` in the project root. See SPEC.md section 9.

## Git hooks

```sh
# .githooks/pre-commit
npx idk-plans fix && git add -u

# .githooks/pre-push
npx idk-plans check --quiet
```

Turn them on with `git config core.hooksPath .githooks`.

## Obsidian

- Open the project folder as a vault (*Open folder as vault*). Exclude `node_modules`, `dist`, and other build folders in *Files and links → Excluded files*.
- To show `[/]`, `[>]`, and `[-]` differently from done tasks, copy `node_modules/idk-plans/obsidian/idk-plans-tasks.css` to `<vault>/.obsidian/snippets/` and turn it on in *Appearance → CSS snippets*.
- To collapse `<details>` blocks with Markdown inside in Reading view, use the *Details Markdown* community plugin. Live Preview still shows raw Markdown inside them.

## Site

`idk-plans site --out _site` builds a static site: one page per node with breadcrumbs, progress, child cards, backlinks, and clickable diagrams; a sidebar with every tree; search; a Tasks page; and a Glossary. Set `site.sourceUrl` in the configuration, or pass `--source-url`, so that links to code files go to your forge.

To publish on Codeberg Pages, build the site in Forgejo Actions and push it to the `pages` branch. See `.gitea/workflows/pages.yml` in idk-net for a working example.


# idk-plans

Keep your project's architecture and progress in Markdown files next to the
code. idk-plans checks them, keeps the generated parts current, and shows
progress that rolls up from tasks to the top of the project.

- **[SPEC.md](SPEC.md)**: the format. Start here.
- **Status:** 0.1.0 draft. The format can change.

## What it does

- Each doc page has an `id` and a `parent`, so the pages make a tree.
- A page can also be in other trees, such as a "concerns" tree, with
  dot-separated paths: `parents: { concern: security.peer-auth }`.
- Tasks are checkboxes: `[ ]` todo, `[/]` doing, `[!]` blocked, `[x]` done,
  `[>]` deferred, `[-]` dropped. Progress rolls up through every tree.
- Links use ids (`[trust-store]`). The tool writes the link targets, so the
  links work on Codeberg and GitHub without a site build.
- Generated blocks show progress, child pages, and diagram links. The Markdown
  stays readable without the tool.

## Use

```sh
npm install --save-dev idk-plans

npx idk-plans check    # report problems (CI, pre-push)
npx idk-plans fix      # update generated blocks (pre-commit)
npx idk-plans tree     # show progress in the terminal
npx idk-plans tree --tree concern
npx idk-plans model    # the whole model as JSON, for a site builder
```

Configuration: `idk-plans.config.json` in the project root. See SPEC.md
section 9.

## Git hooks

```sh
# .githooks/pre-commit
npx idk-plans fix && git add -u

# .githooks/pre-push
npx idk-plans check --quiet
```

Turn them on with `git config core.hooksPath .githooks`.

## Not done yet

- The site builder (interactive diagrams, search, glossary).
- A Forgejo Actions workflow that publishes the site to Codeberg Pages.

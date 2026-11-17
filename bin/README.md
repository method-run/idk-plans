---
id: cli
title: Command line
summary: Runs the commands check, fix, tree, model, site, and serve. It is the only part that reads arguments and writes to the terminal.
parent: idk-plans
parents:
  viewer: terminal
code: [bin/idk-plans.js, src/diff.js]
order: 2
aliases: [Command line]
tags: [system/cli, viewer/terminal/cli]
---
# Command line

<!-- idk-plans:progress:start (generated) -->
● 100% (6/6)
<!-- idk-plans:progress:end -->

The `idk-plans` command is how people and CI use the tool. Each command loads the project with the [Engine](../src/README.md "engine"), then does one job.

| Command | Changes files | Use |
|---|---|---|
| `init` | yes | Once, to start a project ([Init](../src/init.md "init")). |
| `check` | no | In CI and in a pre-push hook, with `--strict`. |
| `fix` | yes | Before you commit. Add `--dry-run` to see the changes first. |
| `tree` | no | To see progress in the terminal. |
| `model` | no | To give the model to another tool, as JSON. |
| `site` | no | To build the website. |
| `serve` | no | To read the website while you work. It rebuilds and reloads the page when a file changes. |

<details>
<summary>How it works</summary>

[bin/idk-plans.js](idk-plans.js) reads the options with `node:util` `parseArgs`. It calls `loadProject` once, then the function for the command.

Problems have three levels. An **error** means that pages can not be built, so `site`, `serve`, and `tree` stop on it too, and print the same lines as `check`. A **warning** means a page is wrong, but it is still built. **Info** is a hint. Each line starts with the level, in color in a terminal (set `NO_COLOR` to turn color off):

```
✖ error   (project)  there is no root page; give README.md frontmatter with an id, title, and summary, ...  [no-root]
⚠ warning README.md:1  summary is required  [bad-field]
```

Exit codes:

- `0`: no errors.
- `1`: there is an error. With `--strict`, `check` and `fix` also exit with 1 on a warning.
- `2`: the tool could not run, for example because the configuration is not valid.

`check --quiet` shows only the problems that make it fail. `site` builds when there are warnings, then lists them.

`fix` runs `check` again after it writes, and shows what is left.

`fix --dry-run` calls `planFixes`, and prints a short line diff for each file ([src/diff.js](../src/diff.js)). It writes nothing, and exits with 0.

`serve` does not stop until you press Ctrl+C. Give `--port` and `--host` to change where it listens.

`init` does not load the project first, because a new project has no configuration yet.

</details>

## Tasks

- [x] Run check, fix, tree, model, and site
- [x] Exit with 1 when check finds an error
- [x] Show what `fix` would change without writing it (`fix --dry-run`)
- [x] Write starter files for a new project (`init`)
- [x] Serve the site, and reload it when a file changes (`serve`)
- [x] Stop every command that builds on the same errors as `check`, and fail on warnings only with `--strict`

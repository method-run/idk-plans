---
id: cli
title: Command line
summary: Runs the commands check, fix, tree, model, and site. It is the only part that reads arguments and writes to the terminal.
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
● 100% (4/4)
<!-- idk-plans:progress:end -->

The `idk-plans` command is how people and CI use the tool. Each command loads the project with the [Engine](../src/README.md "engine"), then does one job.

| Command | Changes files | Use |
|---|---|---|
| `init` | yes | Once, to start a project ([Init](../src/init.md "init")). |
| `check` | no | In CI and in a pre-push hook. |
| `fix` | yes | Before you commit. Add `--dry-run` to see the changes first. |
| `tree` | no | To see progress in the terminal. |
| `model` | no | To give the model to another tool, as JSON. |
| `site` | no | To build the website. |

<details>
<summary>How it works</summary>

[bin/idk-plans.js](idk-plans.js) reads the options with `node:util` `parseArgs`. It calls `loadProject` once, then the function for the command.

Exit codes:

- `0`: no errors.
- `1`: `check` or `fix` found an error.
- `2`: the tool could not run, for example because the configuration is not valid.

`fix` runs `check` again after it writes, and shows what is left.

`fix --dry-run` calls `planFixes`, and prints a short line diff for each file ([src/diff.js](../src/diff.js)). It writes nothing, and exits with 0.

`init` does not load the project first, because a new project has no configuration yet.

</details>

## Tasks

- [x] Run check, fix, tree, model, and site
- [x] Exit with 1 when check finds an error
- [x] Show what `fix` would change without writing it (`fix --dry-run`)
- [x] Write starter files for a new project (`init`)

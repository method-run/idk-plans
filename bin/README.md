---
id: cli
title: Command line
summary: Runs the commands check, fix, tree, model, and site. It is the only part that reads arguments and writes to the terminal.
parent: idk-plans
parents:
  viewer: terminal
code: [bin/idk-plans.js]
order: 2
aliases: [Command line]
tags: [system/cli, viewer/terminal/cli]
---
# Command line

<!-- idk-plans:progress:start (generated) -->
◐ 66% (2/3)
<!-- idk-plans:progress:end -->

The `idk-plans` command is how people and CI use the tool. Each command loads the project with the [Engine](../src/README.md "engine"), then does one job.

| Command | Changes files | Use |
|---|---|---|
| `check` | no | In CI and in a pre-push hook. |
| `fix` | yes | Before you commit. |
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

</details>

## Tasks

- [x] Run check, fix, tree, model, and site
- [x] Exit with 1 when check finds an error
- [ ] Show what `fix` would change without writing it (`fix --dry-run`)

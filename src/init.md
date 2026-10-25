---
id: init
title: Init
summary: Writes starter files for a new project. It does not change a file that exists, so you can run it again safely.
parent: engine
code: [src/init.js]
order: 8
tags: [system/engine/init]
---
# Init

<!-- idk-plans:progress:start (generated) -->
● 100% (3/3)
<!-- idk-plans:progress:end -->

`idk-plans init` gives a new project a working setup in one step. After it runs, `check` finds no problems.

It writes these files, if they do not exist:

- `idk-plans.config.json`, with the README as the root page.
- `README.md`, with a progress block and a list of child pages.
- With `--ci github` or `--ci gitlab`, a workflow that checks the docs and publishes the site ([Publish the site](../docs/publish-site.md "publish-site")).
- With `--hooks`, git hooks in `.githooks/` that run `fix` before each commit and `check` before each push.

It also adds `_site/` to `.gitignore`.

<details>
<summary>How it works</summary>

[src/init.js](init.js) `initProject` writes each file only if it does not exist, and reports "created", "updated", or "skipped" for each file. The root id comes from the `name` in `package.json`, or from the folder name.

The command line then runs `fix` once, so the generated blocks of the new README are current.

The workflow and hook templates are copies of the ones in the docs. A test checks that they stay the same.

</details>

## Tasks

- [x] Write the configuration and a root README
- [x] Write a CI workflow for GitHub or GitLab
- [x] Write git hooks

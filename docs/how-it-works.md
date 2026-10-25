---
id: how-it-works
title: How it works
summary: What idk-plans does when you run a command, step by step. The tool is deterministic, and it does not use AI or the network.
parent: idk-plans
kind: guide
order: 1.5
aliases: [How it works]
tags: [system/how-it-works]
---
# How it works

Every command reads your Markdown files, builds one model of the project, and then does one job with that model. The same files and configuration always give the same result.

## What it does not do

- **It does not use AI.** No step calls a language model or any other service. The rules and the generated text come from fixed code.
- **It does not use the network.** It only reads and writes files in your project.
- **The site can use the network.** By default, pages of the site load the diagram library from a CDN, in the reader's browser. To stop this, set `"site": { "mermaid": "local" }` ([Site builder](../src/site.md "site")).

## The steps

Every command starts with the same four steps:

1. **Read the configuration.** The tool reads `idk-plans.config.json`, and fills in defaults. If the configuration is not valid, the tool stops ([Configuration](../src/config.md "config")).
2. **Find the files.** The tool finds the Markdown files that the configuration includes ([Scan](../src/scan.md "scan")).
3. **Read each file.** The tool reads the frontmatter, the tasks, the links, and the generated blocks of each file ([Parse](../src/parse.md "parse")).
4. **Build the model.** The tool joins the files into trees. It counts the tasks of each page, and adds them up to the top of each tree ([Model](../src/model.md "model")).

Then the command does its job:

5. **`check`** finds problems, such as broken links, missing parents, and generated blocks that are out of date. It exits with an error if it finds one, so CI can stop a broken change.
6. **`fix`** writes the parts of the files that the tool owns: generated blocks, link paths, task marks, aliases, and tags. It also joins prose that is wrapped by hand ([Fix](../src/fix.md "fix")).
7. **`tree`** shows each tree and its progress in the terminal.
8. **`site`** builds a static website, with search, a sidebar for each tree, and diagrams that link to pages ([Site builder](../src/site.md "site")).
9. **`model`** writes the model as JSON, so that other tools can use it.

<details>
<summary>How it works</summary>

`loadProject` in [src/index.js](../src/index.js) runs steps 1 to 4. Each command in [bin/idk-plans.js](../bin/idk-plans.js) calls it once, then calls the function for its job.

`check` runs the fix step in memory, and compares the result with the files. So `check` and `fix` always agree about what is current.

`fix` is idempotent: a second run changes nothing. The tests check this on this repository and on a project that needs every kind of fix.

The [Command line](../bin/README.md "cli") page lists the options and the exit codes.

</details>

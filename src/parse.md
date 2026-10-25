---
id: parse
title: Parse
summary: >-
  Reads one Markdown file into facts: frontmatter, tasks, links, diagrams, and generated blocks. It does not look at other files.
parent: engine
code: [src/parse.js]
order: 3
tags: [system/engine/parse]
---
# Parse

<!-- idk-plans:progress:start (generated) -->
● 100% (3/3)
<!-- idk-plans:progress:end -->

Parse turns one file into the facts that the [Model](./model.md "model") needs. Because it reads one file at a time, a mistake in one file does not stop the others.

<details>
<summary>How it works</summary>

[src/parse.js](parse.js) reads the file line by line. It skips code blocks, inline code, and generated blocks, so examples in them are not counted as tasks or links.

It records:

- The frontmatter, or the YAML error.
- Each task, with its mark, its state, and its parent task. `#blocked` on an open task makes the state `blocked`.
- Marks that are not task marks, for the `unknown-mark` check.
- Each link and reference, with its position, so that `fix` can rewrite it.
- Each Mermaid block and the node ids in it. Text on edges is not an id.
- Each generated block.

</details>

## Tasks

- [x] Read the five task marks, and `#blocked`
- [x] Ignore tasks and links in code
- [x] Report marks that are not task marks

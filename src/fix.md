---
id: fix
title: Fix
summary: >-
  Writes the parts of each file that the tool owns: generated blocks, link paths, task marks, aliases, and tree tags.
parent: engine
parents:
  viewer: [forges, obsidian]
code: [src/fix.js]
order: 5
tags: [system/engine/fix, viewer/forges/fix, viewer/obsidian/fix]
---
# Fix

<!-- idk-plans:progress:start (generated) -->
● 100% (4/4)
<!-- idk-plans:progress:end -->

Fix keeps files current, so that people only write the parts that need a person. It changes only what the tool owns, and leaves all other text as it is.

<details>
<summary>How it works</summary>

[src/fix.js](fix.js) `fixDocument` changes one file:

- It corrects the mark on each task that has subtasks.
- It changes short links such as `[trust-store]` to inline links with the path and the id.
- It fills the `progress`, `children`, `trees`, and `zoom` blocks.
- It adds the title to `aliases`, and writes tree tags.
- It joins hand-wrapped prose, with [Prose unwrap](./wrap.md "wrap").

Frontmatter edits change only the `aliases` and `tags` lines, so the rest of the frontmatter keeps its format.

</details>

## Tasks

- [x] Fill generated blocks
- [x] Write link paths, and correct them when files move
- [x] Write aliases and tree tags for Obsidian
- [x] Remove `refs` blocks from earlier drafts

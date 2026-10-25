---
id: obsidian
title: Obsidian setup
summary: Lets you read and edit the docs in Obsidian, with working links, backlinks, tags for each tree, and distinct task marks.
parent: compatibility
parents:
  viewer: compatibility
kind: guide
code: [obsidian/]
aliases: [Obsidian support, Obsidian setup]
tags: [system/compatibility/obsidian, viewer/markdown/compatibility/obsidian]
---
# Obsidian setup

<!-- idk-plans:progress:start (generated) -->
◐ 66% (2/3)
<!-- idk-plans:progress:end -->

You can open a project as an Obsidian vault. Links, backlinks, search by title, and the tag pane work without plugins, because `fix` writes inline links, aliases, and tree tags.

## Set up

1. Open the project folder as a vault (*Open folder as vault*). Do not use *Create new vault*, because it makes a new folder.
2. Add `.obsidian/` to `.gitignore`.
3. Exclude `node_modules`, `dist`, and other build folders in *Files and links → Excluded files*.
4. Copy `node_modules/idk-plans/obsidian/idk-plans-tasks.css` to `<vault>/.obsidian/snippets/`. Turn it on in *Appearance → CSS snippets*. Without it, Obsidian shows `[/]`, `[>]`, and `[-]` as done.
5. To collapse `<details>` elements that have Markdown inside, install the *Details Markdown* community plugin. It works in Reading view only.

## What works

- The tag pane shows each tree. `tag:#system/engine` finds the whole engine branch.
- Search by title finds `README.md` pages, because `fix` adds titles to `aliases`.
- Mermaid diagrams show without plugins.

<details>
<summary>Why it works this way</summary>

Obsidian does not follow reference-style links (`[text][id]`). So `fix` writes inline links, with the id in the link title.

The *Details Markdown* plugin has no network or file access, and uses Obsidian's own renderer. Plugin updates can change that, so do not turn on automatic updates for it.

</details>

## Tasks

- [x] Ship a CSS snippet for the task marks
- [x] Write tree tags and title aliases
- [ ] Decide whether to support Obsidian callouts as a second form of `<details>`

---
id: obsidian
title: Working in Obsidian
summary: How to read and edit the docs in Obsidian, and how to work around the two places where Obsidian shows them wrongly.
parent: compatibility
parents:
  viewer: compatibility
kind: guide
code: [obsidian/]
aliases: [Obsidian support, Obsidian setup, Working in Obsidian]
tags: [system/compatibility/obsidian, viewer/markdown/compatibility/obsidian]
---
# Working in Obsidian

<!-- idk-plans:progress:start (generated) -->
● 100% (3/3)
<!-- idk-plans:progress:end -->

You can open a project as an Obsidian vault. Links, backlinks, search by title, and the tag pane work without plugins, because `fix` writes inline links, aliases, and tree tags.

Obsidian shows two things wrongly: some task marks, and `<details>`. This page gives a workaround for each.

## Set up the vault

1. Open the project folder as a vault (*Open folder as vault*). Do not use *Create new vault*, because it makes a new folder.
2. Add `.obsidian/` to `.gitignore`.
3. Exclude `node_modules`, `dist`, and other build folders in *Files and links → Excluded files*.

## Task marks

**Problem:** Obsidian draws every mark that is not a space as a checked box. So `[/]` doing, `[>]` deferred, and `[-]` dropped all look done.

**Workaround:** turn on the CSS snippet that ships with idk-plans. It gives each mark its own look.

1. Copy `node_modules/@method-run/idk-plans/obsidian/idk-plans-tasks.css` to `<vault>/.obsidian/snippets/`.
2. Turn it on in *Appearance → CSS snippets*.

Themes that support these marks, such as Minimal, also work without the snippet.

## Collapsible sections

**Problem:** Obsidian does not show `<details>` reliably. In Reading view, part of a closed section can still show. In Live Preview, the Markdown inside shows as raw text.

**Workarounds:** choose one.

- **Write callouts (recommended for Obsidian).** `> [!note]- How it works`, with `>` at the start of each body line. Obsidian collapses them in every view, without plugins. Code hosts show them as plain quotes, so see [Tested viewers](../docs/compatibility.md "compatibility") before you choose.
- **Keep `<details>`, and install the *Details Markdown* community plugin.** It fixes Reading view only. Live Preview still shows raw Markdown.

Both forms are valid in the same project (section 6.1 of the [Specification](../SPEC.md "spec")).

> [!note]- Why it works this way
> The *Details Markdown* plugin has no network or file access, and uses Obsidian's own renderer. Plugin updates can change that, so do not turn on automatic updates for it.
>
> Obsidian does not follow reference-style links (`[text][id]`). So `fix` writes inline links, with the id in the link title.

## What works without changes

- The tag pane shows each tree. `tag:#system/engine` finds the whole engine branch.
- Search by title finds `README.md` pages, because `fix` adds titles to `aliases`.
- Mermaid diagrams show without plugins. Their boxes are not links, so use the `zoom` links under each diagram.

## Tasks

- [x] Ship a CSS snippet for the task marks
- [x] Write tree tags and title aliases
- [x] Accept callouts as a second form of collapsible section

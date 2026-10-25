---
id: compatibility
title: Tested viewers
summary: The viewers that we test the Markdown files and the site with, and what each one shows differently.
parent: idk-plans
parents:
  viewer: markdown
kind: reference
aliases: [compatibility, Tested viewers]
order: 4
tags: [system/compatibility, viewer/markdown/compatibility]
---
# Tested viewers

<!-- idk-plans:progress:start (generated) -->
◐ 50% (3/6)
<!-- idk-plans:progress:end -->

The Markdown files must be useful and easy to move through without the tool. We test them in three viewers: GitHub, Codeberg, and Obsidian. Other Markdown viewers probably work too, but we do not test them.

We publish the site on GitHub Pages and on Codeberg Pages. See [Publish the site](./publish-site.md "publish-site").

## What each viewer does

| | GitHub and Codeberg | Obsidian |
|---|---|---|
| Wrapped lines | Joined into one paragraph | Shown as line breaks, so `fix` joins them ([Prose unwrap](../src/wrap.md "wrap")) |
| `[ ]` and `[x]` | Checkboxes | Checkboxes |
| `[/]`, `[>]`, `[-]` | Shown as text | Shown as done, unless you use the CSS snippet ([Obsidian setup](../obsidian/README.md "obsidian")) |
| `#blocked` | Text | A tag, so the tag pane lists every blocked task |
| Inline links with an id title | Work; the id is a tooltip | Work, and count as backlinks |
| Reference links (`[text][id]`) | Work | Do not work, so `fix` writes inline links |
| `<details>` | Collapses, with Markdown inside | Shows the Markdown inside as raw text, unless you use a plugin ([Obsidian setup](../obsidian/README.md "obsidian")) |
| Mermaid | Drawn, but boxes are not links, so `fix` writes a `zoom` block | Drawn, but boxes are not links |
| Directory `README.md` | Shown when you open the directory | One of many files named `README.md`, so `fix` adds titles to `aliases` |
| Frontmatter `tags` | Not used | Nested tags, one for each tree |

## Tasks

- [x] Check the docs in Obsidian
- [ ] Check the docs on GitHub
- [ ] Check the docs on Codeberg

---
id: wrap
title: Prose unwrap
summary: Finds prose that is wrapped by hand, and joins it into one line for each paragraph, so that Obsidian does not break sentences.
parent: engine
parents:
  viewer: obsidian
code: [src/wrap.js]
order: 6
aliases: [Prose unwrap]
tags: [system/engine/wrap, viewer/obsidian/wrap]
---
# Prose unwrap

<!-- idk-plans:progress:start (generated) -->
● 100% (2/2) · 1 deferred
<!-- idk-plans:progress:end -->

Obsidian shows each line break, so text that is wrapped by hand breaks in the middle of sentences. `check` reports wrapped text, and `fix` joins it. Teams that read raw Markdown can turn this off with `"proseWrap": "preserve"`.

<details>
<summary>How it works</summary>

[src/wrap.js](wrap.js) `unwrapProse` joins a line to the line before it only when Markdown already joins them. So the rendered page does not change.

It does not join lines in frontmatter, code, tables, HTML, headings, link definitions, or after a hard break. When it is not sure, it leaves the line.

</details>

## Tasks

- [x] Join wrapped paragraphs, list items, and quotes
- [x] Report wrapped text in `check`
- [>] Wrap prose at a fixed width (`"proseWrap": "always"`)

---
id: scan
title: Scan
summary: Finds the Markdown files that the configuration includes, and skips the files that it excludes.
parent: engine
code: [src/scan.js]
order: 2
tags: [system/engine/scan]
---
# Scan

<!-- idk-plans:progress:start (generated) -->
● 100% (2/2)
<!-- idk-plans:progress:end -->

Scan finds the files to read. It always skips folders that start with a dot, such as `.git` and `.obsidian`.

<details>
<summary>How it works</summary>

[src/scan.js](scan.js) walks the project folder. It matches each path against `include` and `exclude` with `picomatch`. It returns sorted paths with forward slashes, so the output is the same on every system.

</details>

## Tasks

- [x] Match include and exclude patterns
- [x] Skip dot folders

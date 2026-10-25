---
id: model
title: Model
summary: Joins the parsed files into nodes and trees, calculates every rollup, and finds problems that need more than one file.
parent: engine
code: [src/model.js]
order: 4
tags: [system/engine/model]
---
# Model

<!-- idk-plans:progress:start (generated) -->
● 100% (3/3)
<!-- idk-plans:progress:end -->

The model is the one source for everything that the tool shows. It knows each node, its place in each tree, its tasks, and its progress.

<details>
<summary>How it works</summary>

[src/model.js](model.js) `buildModel` works in steps:

1. Make a node for each file with an `id`, and for the root.
2. Read each parent path. Make virtual nodes for groups and for ids inside longer paths. Report paths that do not agree.
3. Find cycles.
4. Calculate the state of each task and node.
5. Calculate rollups as sets of tasks, so a task counts one time even when two routes reach it.
6. Check links, and record which nodes link to which.

`toJSON` writes the model in the format of section 12 of the [Specification](../SPEC.md "spec").

</details>

<details>
<summary>Why it works this way</summary>

Rollups use sets, not sums. In trees other than the primary tree, a node can have two parents. With sums, a task under both parents would count two times at the top.

</details>

## Tasks

- [x] Make virtual nodes from paths and groups
- [x] Report path mismatches, cycles, and missing parents
- [x] Calculate rollups as sets

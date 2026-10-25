---
id: config
title: Configuration
summary: Reads idk-plans.config.json and fills in defaults. It also holds the JSON schema that editors use to check the file.
parent: engine
code: [src/config.js, schema/config.schema.json]
order: 1
aliases: [Configuration]
tags: [system/engine/config]
---
# Configuration

<!-- idk-plans:progress:start (generated) -->
● 100% (3/3)
<!-- idk-plans:progress:end -->

The configuration names the trees, the files to scan, and how loud each check is. A project without a configuration file gets one tree, `system`, and the default rules.

<details>
<summary>How it works</summary>

[src/config.js](config.js) reads the file, if there is one. `resolveConfig` fills in defaults and stops with an error when a value is not valid. For example, exactly one tree must be primary.

[schema/config.schema.json](../schema/config.schema.json) describes the same fields for editors. Put `"$schema": "./node_modules/@method-run/idk-plans/schema/config.schema.json"` in the file to get completion and warnings.

Section 9 of the [Specification](../SPEC.md "spec") lists every field.

</details>

## Tasks

- [x] Default to one primary tree
- [x] Let each rule be error, warn, info, or off
- [x] Add `proseWrap`

---
id: site
title: Site builder
summary: Builds a static website from the model, with diagrams that link to pages, a sidebar for each tree, search, and a list of open tasks.
parent: engine
code: [src/site.js, site-assets/]
order: 7
aliases: [Site builder]
tags: [system/engine/site, viewer/site]
---
# Site builder

<!-- idk-plans:progress:start (generated) -->
◐ 50% (3/6)
<!-- idk-plans:progress:end -->

The site shows the same pages as the Markdown files, with more ways to move around. It needs no server, so you can open it from a folder or put it on any static host.

To put the site on Codeberg Pages, see [Publish the site](../docs/publish-site.md "publish-site").

<details>
<summary>How it works</summary>

[src/site.js](site.js) `buildSite` writes one page for each node, virtual node, and tree top. It also writes a Tasks page, a Glossary page, and a search index. Every link is relative.

It renders Markdown with `marked`. Links to nodes go to their pages. Links to other files go to `site.sourceUrl`, if it is set.

[site-assets/](../site-assets/) holds the stylesheet and the browser script. The script makes boxes in Mermaid diagrams into links, and runs the search and the sidebar tabs.

Mermaid loads from a CDN in the browser, with `securityLevel: 'strict'`.

</details>

## Tasks

- [x] Make diagram boxes into links
- [x] Show a sidebar for each tree, and search
- [x] List open tasks, and a glossary
- [ ] Include Mermaid in the site, so diagrams work offline
- [ ] Check the layout on a phone

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
◐ 62% (5/8)
<!-- idk-plans:progress:end -->

The site shows the same pages as the Markdown files, with more ways to move around. It needs no server, so you can open it from a folder or put it on any static host.

The site is static files, so any static host can serve it. See [Publish the site](../docs/publish-site.md "publish-site").

<details>
<summary>How it works</summary>

[src/site.js](site.js) `buildSite` writes one page for each node, virtual node, and tree top. It also writes a Tasks page, a Glossary page, and a search index. Every link is relative.

It renders Markdown with `marked`. Links to nodes go to their pages. Links to other files go to `site.sourceUrl`, if it is set.

[site-assets/](../site-assets/) holds the stylesheet and the browser script. The script makes boxes in Mermaid diagrams into links, and runs the search and the sidebar tabs.

Mermaid runs in the browser, with `securityLevel: 'strict'`. By default, pages load Mermaid from a CDN. With `"site": { "mermaid": "local" }` in the configuration, `buildSite` copies the project's own single-file build (`mermaid.min.js`, about 2.5 MB) into the site, so diagrams work offline. idk-plans does not depend on Mermaid, so the project must install it.

</details>

## Tasks

- [x] Make diagram boxes into links
- [x] Show a sidebar for each tree, and search
- [x] List open tasks, and a glossary
- [x] Use the project's own Mermaid, so diagrams work offline
- [ ] Check the layout on a phone

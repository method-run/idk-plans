---
id: site
title: Site builder
summary: Builds a static website from the model, with diagrams that link to pages, a sidebar for each tree, search, and a list of open tasks.
parent: engine
code: [src/site.js, src/serve.js, src/problems.js, src/theme.js, site-assets/]
order: 7
aliases: [Site builder]
tags: [system/engine/site, viewer/site]
---
# Site builder

<!-- idk-plans:progress:start (generated) -->
◐ 82% (14/17)
<!-- idk-plans:progress:end -->

The site shows the same pages as the Markdown files, with more ways to move around. It needs no server, so you can open it from a folder or put it on any static host.

While you work, `idk-plans serve` shows the site at `http://127.0.0.1:4747/`. When you save a Markdown file or the configuration, it builds the site again, and open pages reload. So you can read the plans next to the code, and change both at the same time.

The sidebar, the top bar, and the settings menu are always dark. On a wide screen, a reader can collapse the sidebar with the chevron at its bottom, and drag its right edge to make it wider or narrower. The site remembers both, and the color mode, in the reader's browser.

To skin the site with a theme from idk-themetron, see [Themes](../docs/themes.md "themes").

The site is static files, so any static host can serve it. See [Publish the site](../docs/publish-site.md "publish-site").

<details>
<summary>How it works</summary>

[src/site.js](site.js) `buildSite` writes one page for each node, virtual node, and tree top. It also writes a Tasks page, a Glossary page, and a search index. Every link is relative.

It renders Markdown with `marked`. Links to nodes go to their pages. Links to other files go to `site.sourceUrl`, if it is set.

[site-assets/](../site-assets/) holds the stylesheet and the browser script. The script makes boxes in Mermaid diagrams into links, and runs the search and the sidebar tabs.

[src/serve.js](serve.js) `serveSite` builds the site into a temporary folder, and serves it with `node:http`. It watches the project with `fs.watch`, and builds again 100 ms after a Markdown file or the configuration changes. Each build goes into a new folder, so a request never gets a half-built site. Each HTML page gets a short script that listens for server-sent events, and reloads the page after a build. When `check` finds an error, `serve` does not build: the last good site stays up, with the errors across the top of the page. Warnings show in a closed box at the bottom. Both use the same text as `check` ([src/problems.js](problems.js)). `serve` does not write to the project, and does not run `fix`.

`serve` also builds again when the site's own stylesheet or script changes, in [site-assets/](../site-assets/). A change to the code of idk-plans needs a new process, because Node.js loads the code once. `npm run docs:serve` in this repository runs `serve` with `node --watch`, which starts it again when its code changes. Each process sends its id to the open pages, and a page that connects to a new process reloads. Without `--watch`, `serve` says when its code changed: in the terminal, and on the page.

Mermaid runs in the browser, with `securityLevel: 'strict'`. By default, pages load Mermaid from a CDN. With `"site": { "mermaid": "local" }` in the configuration, `buildSite` copies the project's own single-file build (`mermaid.min.js`, about 2.5 MB) into the site, so diagrams work offline. idk-plans does not depend on Mermaid, so the project must install it.

</details>

## Tasks

- [x] Make diagram boxes into links
- [x] Show a sidebar for each tree, and search
- [x] List open tasks, and a glossary
- [x] Use the project's own Mermaid, so diagrams work offline
- [x] Serve the site while you work, and reload it when a file changes
- [ ] Check the layout on a phone
- [ ] Give the site a theme with more character: type, color, and spacing. The current style is plain.

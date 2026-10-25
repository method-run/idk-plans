---
id: compatibility
title: Tested viewers
summary: The viewers that we test the Markdown files and the site with, and what each one shows differently.
parent: idk-plans
parents:
  viewer: markdown
kind: reference
aliases: [compatibility, supported viewers, Tested viewers]
order: 4
tags: [system/compatibility, viewer/markdown/compatibility]
---
# Tested viewers

<!-- idk-plans:progress:start (generated) -->
◐ 66% (4/6) · 1 deferred
<!-- idk-plans:progress:end -->

The Markdown files must be useful and easy to move through without the tool. We test them in three viewers: GitHub, Codeberg, and Obsidian. We also list GitLab, from its documentation, but we do not test it. Other Markdown viewers probably work too.

The three code hosts use different Markdown engines, but all of them follow CommonMark and the main GitHub extensions. So they show the files in almost the same way. The differences are under Known problems.

We publish the site on GitHub Pages and on Codeberg Pages. See [Publish the site](./publish-site.md "publish-site").

## What each viewer does

| | Code hosts: GitHub, Codeberg, GitLab | Obsidian |
|---|---|---|
| Wrapped lines | Joined into one paragraph | Shown as line breaks, so `fix` joins them ([Prose unwrap](../src/wrap.md "wrap")) |
| `[ ]` and `[x]` | Checkboxes | Checkboxes |
| `[/]`, `[>]`, `[-]` | Shown as text | Shown as done (see below) |
| `#blocked` | Text | A tag, so the tag pane lists every blocked task |
| Inline links with an id title | Work; the id is a tooltip | Work, and count as backlinks |
| Reference links (`[text][id]`) | Work | Do not work, so `fix` writes inline links |
| `<details>` | Collapses, with Markdown inside | Not reliable (see below) |
| Callouts (`> [!note]- Title`) | Do not collapse (see below) | Collapses, in Reading view and Live Preview |
| Mermaid | Drawn, but boxes are not links, so `fix` writes a `zoom` block | Drawn, but boxes are not links |
| Directory `README.md` | Shown when you open the directory | One of many files named `README.md`, so `fix` adds titles to `aliases` |
| Frontmatter | Shown at the top of the page (see below) | Shown as properties |
| Frontmatter `tags` | Not used | Nested tags, one for each tree |

## Known problems

We have not finished checking GitHub and Codeberg, and we have not checked GitLab, so these lists can grow.

### Code hosts

- **Callouts do not collapse.** GitHub and Codeberg show a callout as a plain quote, with `[!note]-` as text. GitLab shows it as a note box, but its documentation does not say that it can fold. If most readers use a code host, use `<details>` for collapsible sections.
- **Other task marks are text.** `[/]`, `[>]`, and `[-]` show as text, not as checkboxes. They are still easy to read, so no workaround is needed.
- **GitLab has one more task mark.** `[~]` means "does not apply" on GitLab. idk-plans does not use it, and reports it as an unknown mark. Use `[-]` (dropped) instead.
- **Diagram boxes are not links.** `fix` writes a `zoom` block of links under each diagram ([Fix](../src/fix.md "fix")).
- **Frontmatter shows at the top of the page.** GitHub shows it as a table. GitLab shows it as raw YAML in a box. This is expected. Keep frontmatter short, and put the content in the body.

### Obsidian

- **Other task marks show as done.** Obsidian draws `[/]`, `[>]`, and `[-]` as checked boxes, so a dropped task looks finished. Workaround: a CSS snippet that ships with idk-plans.
- **`<details>` is not reliable.** In Reading view, part of a closed section can still show. In Live Preview, the Markdown inside shows as raw text. Workaround: write collapsible sections as callouts, or install a plugin that works in Reading view only.
- **Wrapped lines show as line breaks.** `fix` joins them ([Prose unwrap](../src/wrap.md "wrap")).
- **Reference links do not work.** `fix` writes inline links.

[Working in Obsidian](../obsidian/README.md "obsidian") gives the steps for each workaround.

### The site

- **Diagrams need a network connection.** The site loads Mermaid from a CDN. See the open task on the [Site builder](../src/site.md "site") page.

## Tasks

- [x] Check the docs in Obsidian
- [ ] Check the docs on GitHub
- [ ] Check the docs on Codeberg
- [>] Check the docs on GitLab

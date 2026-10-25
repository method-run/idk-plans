---
id: publish-site
title: Publish the site
summary: The site is a folder of static files, so any static host can serve it. This guide shows how to publish it from CI.
parent: site
parents:
  viewer: site
kind: guide
aliases: [Publish the site]
tags: [system/engine/site/publish-site, viewer/site/publish-site]
---
# Publish the site

<!-- idk-plans:progress:start (generated) -->
○ 0% (0/2)
<!-- idk-plans:progress:end -->

`idk-plans site --out _site` writes a folder of HTML, CSS, and JavaScript. Every link in it is relative. So you can put the folder on any static host, under any path, and you do not need a server or a build step on the host.

A good setup builds the site in CI on each push to the main branch:

1. Install the dependencies.
2. Run `idk-plans check`, so a broken docs tree does not publish.
3. Run `idk-plans site`. Give `--source-url`, so links to code files go to the exact commit that the site describes.
4. Give the folder to the host.

The two sections below do this on Codeberg and on GitHub. This repository has both workflows, in [.forgejo/workflows/pages.yml](../.forgejo/workflows/pages.yml) and [.github/workflows/pages.yml](../.github/workflows/pages.yml). They run `npm run docs:check` and `npm run docs:site`. In your project, use `npx idk-plans check --quiet` and `npx idk-plans site --out _site` instead.

## Codeberg

Codeberg Pages serves the `pages` branch of a repository at `https://<owner>.codeberg.page/<repo>/`. The workflow builds the site and pushes it to that branch.

1. In the repository settings, turn on Actions (*Units → Overview*).
2. Make an access token with read and write access to repositories.
3. Add it to the repository as an Actions secret named `PAGES_TOKEN`.
4. Add this workflow as `.forgejo/workflows/pages.yml`:

```yaml
name: Docs site

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  pages:
    runs-on: codeberg-small
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - run: npm ci

      - run: npx idk-plans check --quiet

      - run: >-
          npx idk-plans site --out _site
          --source-url "${{ github.server_url }}/${{ github.repository }}/src/commit/${{ github.sha }}"

      - name: Push to the pages branch
        env:
          PAGES_TOKEN: ${{ secrets.PAGES_TOKEN }}
          SERVER: ${{ github.server_url }}
          REPO: ${{ github.repository }}
          SHA: ${{ github.sha }}
        run: |
          cd _site
          git init -q -b pages
          git config user.name "idk-plans"
          git config user.email "noreply@codeberg.org"
          git add -A
          git commit -q -m "Docs site for ${SHA}"
          git push -q --force "https://oauth2:${PAGES_TOKEN}@${SERVER#https://}/${REPO}.git" pages
```

<details>
<summary>Notes</summary>

`codeberg-small` is a Codeberg hosted runner. A runner label such as `ubuntu-latest` does not run on Codeberg's hosted runners.

The `pages` branch has only the newest site, because the workflow replaces it on each push.

</details>

## GitHub

GitHub Pages serves the site at `https://<owner>.github.io/<repo>/`. The workflow gives the folder to GitHub Pages directly, so you do not need a branch or a token.

1. In the repository settings, open *Pages*, and set *Source* to *GitHub Actions*.
2. Add this workflow as `.github/workflows/pages.yml`:

```yaml
name: Docs site

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - run: npm ci

      - run: npx idk-plans check --quiet

      - run: >-
          npx idk-plans site --out _site
          --source-url "${{ github.server_url }}/${{ github.repository }}/blob/${{ github.sha }}"

      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Tasks

- [ ] Publish this repository's site on Codeberg Pages
- [ ] Publish this repository's site on GitHub Pages

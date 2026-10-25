---
id: publish-site
title: Publish the site
summary: Builds the site in Forgejo Actions on each push to main, and publishes it with Codeberg Pages.
parent: site
parents:
  viewer: site
kind: guide
aliases: [Publish the site]
tags: [system/engine/site/publish-site, viewer/site/publish-site]
---
# Publish the site

<!-- idk-plans:progress:start (generated) -->
○ 0% (0/1)
<!-- idk-plans:progress:end -->

Codeberg Pages serves the `pages` branch of a repository at `https://<owner>.codeberg.page/<repo>/`. A workflow can build the site and push it to that branch.

## Set up

1. Turn on Actions in the repository settings.
2. Make a Codeberg access token with read and write access to repositories.
3. Add it to the repository as an Actions secret named `PAGES_TOKEN`.
4. Add the workflow below as `.forgejo/workflows/pages.yml`. Forgejo also reads `.gitea/workflows/`.

```yaml
name: Docs site

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  pages:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install
        run: npm ci

      - name: Check the docs
        run: npx idk-plans check --quiet

      - name: Build the site
        run: >-
          npx idk-plans site --out _site
          --source-url "${{ github.server_url }}/${{ github.repository }}/src/commit/${{ github.sha }}"

      - name: Publish to the pages branch
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

`--source-url` makes links to code files go to the exact commit that the site describes.

## Tasks

- [ ] Run the workflow on a real Codeberg repository

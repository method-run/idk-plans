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
● 100% (2/2)
<!-- idk-plans:progress:end -->

`idk-plans site --out _site` writes a folder of HTML, CSS, and JavaScript. Every link in it is relative. So you can put the folder on any static host, under any path, and you do not need a server or a build step on the host.

A good setup builds the site in CI on each push to the main branch:

1. Install the dependencies.
2. Run `idk-plans check`, so a broken docs tree does not publish.
3. Run `idk-plans site`. Give `--source-url`, so links to code files go to the exact commit that the site describes.
4. Give the folder to the host.

The two sections below do this on GitHub and on GitLab. This repository has both workflows, in [.github/workflows/pages.yml](../.github/workflows/pages.yml) and [.gitlab-ci.yml](../.gitlab-ci.yml). They run `npm run docs:check` and `npm run docs:site`. In your project, use `npx idk-plans check --quiet` and `npx idk-plans site --out _site` instead.

`idk-plans init --ci github` or `idk-plans init --ci gitlab` writes the workflow for that host, as shown below.

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
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: '22'

      - run: npm ci

      - run: npx idk-plans check --quiet

      - run: >-
          npx idk-plans site --out _site
          --source-url "${{ github.server_url }}/${{ github.repository }}/blob/${{ github.sha }}"

      - uses: actions/upload-pages-artifact@v5
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
        uses: actions/deploy-pages@v5
```

## GitLab

GitLab Pages serves the `public` folder from a CI job named `pages`. You do not need a branch or a token.

1. Add this file as `.gitlab-ci.yml` at the root of the repository:

```yaml
image: node:22

pages:
  script:
    - npm ci
    - npx idk-plans check --quiet
    - npx idk-plans site --out public --source-url "$CI_PROJECT_URL/-/blob/$CI_COMMIT_SHA"
  artifacts:
    paths: [public]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

2. Push to the default branch. When the job is done, the address of the site is in *Deploy → Pages*.

<details>
<summary>Notes</summary>

New projects get a unique domain, such as `https://<repo>-<random>.gitlab.io/`. To use `https://<owner>.gitlab.io/<repo>/` instead, turn off *Use unique domain* in *Deploy → Pages*.

On gitlab.com, a new account must verify its identity before the shared runners run its jobs.

</details>

## Tasks

- [x] Publish this repository's site on GitHub Pages
- [x] Publish this repository's site on GitLab Pages

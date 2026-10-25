---
id: release
title: Release a version
summary: How a maintainer releases a new version of idk-plans. A version tag starts a workflow that publishes to npm and makes a GitHub release.
parent: idk-plans
kind: guide
order: 6
aliases: [Release a version]
tags: [system/release]
---
# Release a version

A release needs two commands on your computer. A workflow does the rest, so the npm version, the git tag, and the GitHub release always match.

## Steps

1. On `main`, with a clean working tree, run `npm version patch`, `npm version minor`, or `npm version major`. This changes the version in `package.json`, makes a commit, and adds a tag such as `v0.3.0`.
2. Run `git push --follow-tags`. This pushes the commit and the tag.

The tag starts the Release workflow on GitHub. The workflow:

1. Stops if the tag does not match the version in `package.json`.
2. Runs the tests and the docs check.
3. Publishes the package to npm, with provenance.
4. Makes a GitHub release for the tag, with notes from the commits since the last release.

Use semantic versions. A change to the format follows section 14 of the [Specification](../SPEC.md "spec").

<details>
<summary>How it works</summary>

[.github/workflows/release.yml](../.github/workflows/release.yml) runs on each tag that starts with `v`. npm trusts this workflow through trusted publishing, so the workflow needs no npm token, and npm needs no one-time password.

The workflow skips a step that is already done. So you can run it again after a failure: in the Actions tab, open *Release*, choose *Run workflow*, and give the tag.

Only GitHub publishes. The GitLab copy runs tests and builds the site, but it does not publish.

</details>

<details>
<summary>Setup, once</summary>

On npmjs.com, open the package settings, and add a trusted publisher:

- Publisher: GitHub Actions
- Organization or user: `method-run`
- Repository: `idk-plans`
- Workflow filename: `release.yml`

</details>

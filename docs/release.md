---
id: release
title: Release a version
summary: How a maintainer releases a new version of idk-plans. A version tag starts a workflow that stages the version on npm and makes a GitHub release. The maintainer approves the staged version.
parent: idk-plans
kind: guide
order: 6
aliases: [Release a version]
tags: [system/release]
---
# Release a version

A release needs two commands on your computer, and one approval on npmjs.com. A workflow does the rest, so the npm version, the git tag, and the GitHub release always match.

## Steps

1. On `main`, with a clean working tree, run `npm version patch`, `npm version minor`, or `npm version major`. This changes the version in `package.json`, makes a commit, and adds a tag such as `v0.3.0`.
2. Run `git push --follow-tags`. This pushes the commit and the tag.
3. When the workflow is done, approve the staged version: on npmjs.com, open the package, find the staged version, and approve it with 2FA. Only then can people install it.

The tag starts the Release workflow on GitHub. The workflow:

1. Stops if the tag does not match the version in `package.json`.
2. Runs the tests and the docs check.
3. Stages the package on npm. It is not public until you approve it.
4. Makes a GitHub release for the tag, with notes from the commits since the last release.

Use semantic versions. A change to the format follows section 14 of the [Specification](../SPEC.md "spec").

<details>
<summary>How it works</summary>

[.github/workflows/release.yml](../.github/workflows/release.yml) runs on each tag that starts with `v`. npm trusts this workflow through trusted publishing, so the workflow needs no npm token. The workflow runs `npm stage publish`, not `npm publish`: a stolen workflow can stage a version, but only a maintainer with 2FA can make it public. Staging needs a recent npm, so the workflow installs the latest npm first.

The workflow skips a step that is already done. So you can run it again after a failure: in the Actions tab, open *Release*, choose *Run workflow*, and give the tag. *Run workflow* uses the workflow from `main`, so it also picks up a fix to the workflow. Do not run it again for a version that is staged and waiting: approve that version instead.

Only GitHub publishes. The GitLab copy runs tests and builds the site, but it does not publish.

</details>

<details>
<summary>Setup, once</summary>

On npmjs.com, open the package settings, and add a trusted publisher:

- Publisher: GitHub Actions
- Organization or user: `method-run`
- Repository: `idk-plans`
- Workflow filename: `release.yml`
- Environment: none
- Allowed actions: leave *npm publish* and *npm dist-tag* off. The publisher can then only stage versions.

A new trusted publisher must publish (or stage) once within 2 days, or npm removes it.

</details>

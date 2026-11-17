---
id: themes
title: Themes
summary: Skin the site with a theme from idk-themetron. Export the theme as CSS, put the file in your project, and name it in the configuration.
parent: site
parents:
  viewer: site
kind: guide
tags: [system/engine/site/themes, viewer/site/themes]
---
# Themes

<!-- idk-plans:progress:start (generated) -->
◐ 75% (3/4)
<!-- idk-plans:progress:end -->

The site can take its colors, fonts, edges, and shadows from a theme made with [idk-themetron](https://www.npmjs.com/package/@method-run/idk-themetron). Without a theme, the site keeps its own look.

## Use a theme

1. Make the theme in the [themetron playground](https://method-run.github.io/idk-themetron/), or from an inputs file.
2. Export it in the **css** format. This is the theme's tokens only. In the playground, download "CSS". From the command line:

   ```sh
   npx themetron build inputs.json --format css --out docs/theme.css
   ```

3. Put the file in your project, and name it in `idk-plans.config.json`, as `site.theme`. The path starts at the project root. We suggest `docs/theme.css`.

   ```json
   {
     "site": { "theme": "docs/theme.css" }
   }
   ```

4. Run `idk-plans serve` to see it. `serve` builds the site again when you save the theme file. `idk-plans site`, and so CI, builds the site with the theme too.

The configuration is the place for a project's theme, so every build uses it. To try another theme for a moment, give it on the command line. `--theme` replaces `site.theme` for that command only: `idk-plans serve --theme ~/Downloads/theme.css`.

## Theme files that idk-plans reads

idk-plans reads one kind of file: a stylesheet that **idk-themetron** made for **token contract 0.2**.

| | Read | Not read |
|---|---|---|
| Maker | [idk-themetron](https://www.npmjs.com/package/@method-run/idk-themetron) 0.2.x | Other CSS. A file that sets no `--tm-*` tokens stops the build. |
| Format | `css`: the tokens only. Use this one. `stylesheet` works too: the tokens and themetron's components. The site does not use the components. | `dtcg`, `tailwind`, `shadcn`, `bootstrap`, `bootstrap-css`, `mui`, and `daisyui` |
| Token contract | 0.2.x: the [token manifest](https://method-run.github.io/idk-themetron/schema/0.2.0/tokens.manifest.json), and the [consumer contract](https://github.com/method-run/idk-themetron/blob/main/spec/consumers.md) | Any other version. The build stops, and says which version the file is for. |
| Prefixes | The defaults: tokens `--tm-*`, theme classes `.theme-*` | Other prefixes (`--prefix`, `--class-prefix`). The build stops. |

A theme names its contract on its first line, for example `/* Made by themetron for my-site, token contract 0.2.0: … */`. Exports from before themetron 0.2.1 have no such line. idk-plans reads them as contract 0.2.

When a new version of themetron changes the contract, a new version of idk-plans reads it. Until then, export the theme with themetron 0.2.x.

## Colorways

The site colors task states and callouts with the theme's child themes. It looks for these theme names, and takes the first one that the theme has. The names are themetron's `SEMANTIC_THEMES`.

| Colorway | Theme names, first match first | The site uses it for |
|---|---|---|
| Success | `success`, `positive` | Done tasks and progress, and `tip`, `success`, and `check` callouts |
| Warning | `warning`, `caution`, `attention`, `notice` | Tasks in progress, and `warning` and `question` callouts |
| Danger | `danger`, `error`, `critical`, `negative`, `destructive` | Blocked tasks, `#blocked` tags, and `caution`, `danger`, `error`, and `bug` callouts |
| Info | `info`, `information`, `informative` | `note` and `info` callouts |
| Important | `important`, `secondary` | `important` and `example` callouts |

Everything else, such as links, the current page, and the selected tab, uses the root theme, `default`.

When the theme has no colorway for a part, the part looks as it does without a theme. For example, without a `warning` theme, tasks in progress keep the site's own amber.

A `caution` callout is danger, as on GitHub. In Obsidian, it is a warning.

## What the theme changes

- Colors, in light and dark mode, and the more-contrast variant.
- Fonts: body, heading, and code. The theme loads web fonts from Google Fonts, so the site needs the network for them.
- Shape: buttons are one control tall, with the theme's control radius, so a round theme gives pills. Badges and progress bars round by the theme's roundness.
- Depth and shine: shadows, the lift of a button on hover, and the shine on fills. Buttons shine the way themetron's own buttons do: through backdrop filters, so a see-through button still shows its highlight and shadow.
- Clarity: fills, tints, fields, and edges show at the theme's opacity.
- Space: padding and gaps come from the theme's space scale.
- Gradients: when the theme's action color is a gradient, fills, tints, and links show it.
- Icons: when the theme has icons, callouts, the menu button, the sidebar chevrons, and the settings gear show them.

The layout stays the same: the sidebar, the top bar, and the width of the text.

The top bar and the sidebar are always in dark mode, with or without a theme. The page itself follows the reader's setting. The settings button (a gear at the bottom of the sidebar) opens a menu with the color mode of the page, and, with a theme, the contrast. The reader's choice stays in their browser.

<details>
<summary>How it works</summary>

[src/theme.js](../src/theme.js) reads the theme file. It checks that the file sets `--tm-bg-canvas`, and that its token contract is the one that `THEMETRON_CONTRACT` names. Then it finds the theme classes in the file, and picks a class for each colorway. The site builder copies the file into the site as `assets/theme.css`, and links it before `site.css`.

[site-assets/site.css](../site-assets/site.css) follows themetron's consumer contract: it reads the tokens only with `var()`, and each token has a fallback, which is the site's own look. A part in a colorway has the theme class itself, such as `class="task-mark theme-success"`, and reads the theme's action tokens inside it. `npx themetron check site-assets/site.css` reports 0 unknown tokens.

`<html>` gets the `theme-default` class, so the root theme applies even when the theme was made with `--no-root`. The rules for clarity, shape, and space are scoped to `:root.theme-default`, because a see-through fill has no fallback that looks like the site without a theme. They follow the recipes in themetron's consumer contract.

</details>

## Tasks

- [x] Read a themetron CSS theme from `site.theme` or `--theme`
- [x] Color task states and callouts with the theme's colorways, and keep the site's own colors where the theme has none
- [x] Rebuild in `serve` when the theme file changes
- [ ] Check the site with the theme in the more-contrast mode, in a screen reader

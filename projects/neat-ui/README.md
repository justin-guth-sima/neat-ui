# @sima/neat-ui

SiMa.ai-branded Angular UI kit for Neat applications. See the repository README and AGENTS.md for
development and usage guidance.

## Using the kit in an app

For app authors and their coding agents: the rules, each with its why.

- **Ease with a catalog curve.** Give `neatEased` and `NeatEasedNumber` a name from
  `NEAT_EASINGS` (`ease-in-out`, the default, `ease-out`, `ease-in`, `linear`). A custom function
  only where no name fits. Why: one motion language across apps.
- **Name an icon from the kit's set first.** `neat-icon`'s `name` takes a name from
  `NEAT_ICON_NAMES`; only where none fits, pass a glyph imported from `@sima/neat-ui/lucide`
  (`import { Rocket } from '@sima/neat-ui/lucide'`). Never import `lucide` or `@lucide/angular`
  yourself. Why: the kit's icon library stays swappable, and only the glyphs you import are
  bundled.
- **Never put a CSS `transition` on something `neatEased` moves.** A transition restarted on each
  frame fights the easing.

## Dependencies

`d3-scale` and `d3-shape` (and the d3 packages they depend on) are ISC licensed. Only the
`@sima/neat-ui/charts` entry point uses them, so an app that never imports it does not bundle them.

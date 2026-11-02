# @sima/neat-ui

SiMa.ai-branded Angular UI kit for Neat applications. The rules for an app that uses the kit are
under "Using the kit in an app" below; the repository README and AGENTS.md cover working on the kit
itself.

## Using the kit in an app

For app authors and their coding agents: the rules, each with its why.

- **Import UI only from the kit.** Use its components instead of writing your own or reaching for
  another library. Why: each one carries the theme, accessibility and behaviour decisions already
  made; a re-implementation drifts from them and from every other app.
- **Import each part from its own entry.** `@sima/neat-ui/video`, `@sima/neat-ui/charts` and so
  on, not everything from `@sima/neat-ui`. Why: the main bundle then carries only the entries the
  shell imports, and a lazy route can keep a heavy part (the video canvas most of all) out of it.
- **Never import a `ɵ` name.** Why: the kit's entries share their internals through the primary
  under that prefix; they are not for apps and may change in any release.
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
- **If nothing fits, propose a kit change instead of working around it.** A new component or a new
  input; write down what you need, why the existing parts fall short and the API you would like,
  and raise it with the maintainer. Why: a workaround in one app is invisible to the others and
  hardens into a divergent fork; a kit change is reviewed once and benefits every app.

## Dependencies

`d3-scale` and `d3-shape` (and the d3 packages they depend on) are ISC licensed. Only the
`@sima/neat-ui/charts` entry point uses them, so an app that never imports it does not bundle them.

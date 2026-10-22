# AGENTS.md

Guidance for anyone (human or agent) working in this repository or building an app on `@sima/neat-ui`.
The rules below come with their reasons; if a reason does not apply to your situation, the escape
hatch says what to do instead of working around the rule.

## What this repo is

`neat-ui` is the shared SiMa.ai look and component set for Neat applications (Neat Insight first,
demo apps later). Its value is that every app looks and behaves the same and that a change to the
look happens in one place. Every rule here protects that.

- `projects/neat-ui`: the library (`@sima/neat-ui`). Public API is `projects/neat-ui/src/public-api.ts`.
- `projects/showcase`: the component gallery.

## How the kit is built on Spartan

The components come from Spartan UI: `@spartan-ng/brain` (headless primitives, an npm dependency)
and helm (Spartan's styled layer, generated into the repo). Apps see neither.

- **Public API is `neat-*` only**: components, directives and kit types. Why: no library API
  reaching apps is what keeps a later library swap a kit-only change. Never export brain or helm
  symbols, or re-export a third-party component.
- **Vendored helm lives in `projects/neat-ui/src/lib/ui/`: internal, never exported, never
  hand-edited.** Why: it stays exactly as generated, so an update is a regeneration and a reviewed
  diff, not a three-way merge. It enters only through `npm run helm:add -- <name>` (generate, then
  `tools/adopt-helm.mjs`). To update, bump `@spartan-ng/brain` (exact version; `helm:add` runs the
  Spartan CLI of the same version), delete `lib/ui/<name>`, re-add it and review the diff.
  `npm run check:dist` fails a build that still imports the helm alias.
- **A `neat-*` wrapper is the brain primitive as host directive plus helm's style constants as
  data**, with one table mapping kit vocabulary to Spartan's (see `lib/button/button.ts`). Never put
  a helm directive behind a public host directive: Angular cannot re-expose inputs of a host
  directive's own host directives (NG2017) and requires every host directive of a public directive
  to be exported (NG3001). Bind the classes with Angular's `[class]` host binding, not helm's
  `classes()`, which rewrites `className` and can drop an app's `[class.x]` binding.
- **Customise in this order: theme tokens, then wrapper inputs and classes, never helm.** Tokens
  come from `lib/theme/*.ts`; `npm run theme:emit` regenerates `tokens.generated.css`, and the theme
  spec checks the contrast of every text pair it emits. A wrapper overrides a helm class only where
  its spec shows a failure (the button's hover states are the example), with the reason in a comment.
- **Class strings are literals**, never built at runtime. Why: Tailwind finds the classes the kit
  stylesheet needs by reading the kit's sources; a computed class name is silently missing.
- **Apps need no Tailwind.** The kit ships its compiled stylesheet (`styles/neat-ui.css`), which
  contains exactly the utilities the kit's sources use; utility classes in app templates are not
  part of the kit's API.
- **Tooltips never open on touch** (brain's design: a tap would also trigger the control). A tooltip
  repeats the control's accessible name; never put information only in a tooltip.

## Rules

**Reuse what the kit offers.**
Why: each component carries the theme, accessibility and behaviour decisions already made. A
re-implementation drifts from them and from every other app.
Escape hatch: if nothing fits, go to the next rule.

**If nothing fits, stop and propose a kit change instead of working around it.**
A kit change is a new component or a new input on an existing one. Why: a workaround in one app is
invisible to the others and hardens into a divergent fork; a kit change is reviewed once and
benefits every app. Escape hatch: write the proposal (what you need, why existing components fall
short, the API you would like) and raise it with the maintainer before building; do not ship the
workaround in the meantime.

**Style only through theme tokens and component inputs.**
Why: tokens are what make light/dark and later rebranding work. Overrides (deep selectors,
`!important`, hard-coded sizes or colours) silently break in one theme or after a Spartan update.
Escape hatch: if a look cannot be reached through tokens and inputs, that is a kit gap. Treat it as
a proposal under the previous rule, not as a reason to override.

**No colour literals outside `projects/neat-ui/src/lib/theme/`.**
No hex, `rgb()`, `rgba()`, `hsl()` or `hsla()` anywhere else, in CSS, TypeScript or templates.
Why: the palette is fixed and lives in the theme so both themes stay coherent. Stylelint enforces
this for stylesheets (`npm run lint`). Escape hatch: if you need a colour that is not a token, add a
token in the theme directory through a kit change; never inline the value.
The only exception: official brand-asset SVGs (the SiMa.ai logo) keep their own `fill` attributes.

**Pages fill the shell's content area and own at most one scroll context.**
Why: nested scroll containers and hard-coded heights break on other screen sizes and in kiosk mode,
where the shell's size is not yours to know. Do not measure or hard-code the shell's size. Escape
hatch: if a page needs more than one independently scrolling region (for example a log pane beside a
form), raise it as a kit change so the layout is a supported component, not an ad hoc one.

**Raw browser APIs used for performance stay isolated, outside change detection, with tests.**
Why: canvas, requestAnimationFrame, observers and similar code is fast because it bypasses Angular;
spread through components it makes change detection unpredictable and bugs hard to reproduce.
Keep it in a small, separate unit that runs outside the Angular zone/signals graph, exposes a narrow
interface, and has its own tests. Escape hatch: if the isolation costs too much for a case, say so
in the PR and agree the exception before merging.

**Every component appears in the showcase in both themes.**
Why: the showcase is how people and agents discover what exists (rule one) and how both themes are
checked by eye. A component missing from it will be reinvented. Escape hatch: none for components;
internal building blocks that are not exported need no page.

## Commands

Node 24 is required (`.node-version`; Angular 22 supports `^22.22.3 || ^24.15.0`, we pin 24).

| Command                  | What it does                                                                    |
| ------------------------ | ------------------------------------------------------------------------------- |
| `npm start`              | Showcase dev server                                                             |
| `npm test`               | Unit tests for all projects (`npm test -- --watch=false` runs once and exits)   |
| `npm run lint`           | ESLint (angular-eslint) and Stylelint                                           |
| `npm run build`          | Build the library and its compiled stylesheet into `dist/neat-ui`               |
| `npm run check:dist`     | Check the built package (no helm alias imports, stylesheet present)             |
| `npm run test:tools`     | Tests for the repo tools (`tools/*.test.mjs`)                                   |
| `npm run theme:emit`     | Regenerate `lib/theme/tokens.generated.css` from the theme sources              |
| `npm run helm:add`       | Add a Spartan helm component to `lib/ui/` (`-- <name>`), the only way in        |
| `npm run build:showcase` | Build the showcase app                                                          |
| `npm run pack`           | Build, then write `dist/neat-ui/sima-neat-ui-<version>.tgz` for apps to install |

Run lint, tests and both builds before opening a PR; CI runs the same.

## Quality bar

This is a prototype held to production standards of cleanliness, structure and tests, without
overengineering: no abstraction without a second use or a stated reason, no speculative
configurability. When a quick fix and a clean fix differ, take the clean one or stop and raise it.

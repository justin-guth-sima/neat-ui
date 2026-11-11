# Contributing to neat-ui

How to work on the kit itself: what is where, how to run it, the rules that matter most, and how
to add a component and cut a release. [AGENTS.md](AGENTS.md) is the complete guide, with every rule
and its reason; this page is the way in, and links there for the details.

## What is where

| Folder              | What it holds                                                                        |
| ------------------- | ------------------------------------------------------------------------------------ |
| `projects/neat-ui`  | The kit, published as `@sima/neat-ui`: one primary entry point, one per component    |
| `projects/showcase` | The kit's docs app: every topic's examples, live, with their code and the API        |
| `projects/bench`    | The rendering bench, which measures how much diagram a machine draws. Never shipped  |
| `tools`             | The repo's scripts: docs generation, pictures, checks                                |
| `docs`              | The [writing guide](docs/writing.md), the [glossary](docs/glossary.md), the pictures |

The kit's primary entry point (`@sima/neat-ui`) holds what the shell and every page need. Every
other component has its own entry point (`@sima/neat-ui/dialog`, `@sima/neat-ui/charts`, …), so an
app's main bundle carries only what its shell imports. AGENTS.md lists them all under
[What this repo is](AGENTS.md#what-this-repo-is).

## Run it

You need Node 24 (see `.node-version`).

```bash
npm ci
npm start                     # the showcase, at http://localhost:4200
npm test -- --watch=false     # unit tests for the kit, the showcase and the bench
npm run lint                  # ESLint and Stylelint
npm run test:tools            # the repo tools' tests, and the docs and README checks
npm run build                 # the kit, into dist/neat-ui
```

The showcase is where you see a change: each topic shows its examples in light and dark. The
[Commands](AGENTS.md#commands) table in AGENTS.md lists the rest.

## The rules that matter most

Each of these is in [Rules](AGENTS.md#rules) with its reason and its escape hatch.

- **Reuse what the kit has.** If nothing fits, propose a kit change instead of building around it.
- **Style only through theme tokens and component inputs.** No color literals outside the theme
  folders, no deep selectors, no `!important`.
- **Entry points depend one way.** A secondary entry imports the primary by its package name;
  the primary never imports a secondary one.
- **Never edit the vendored Spartan code** in `projects/neat-ui/src/lib/ui/`. It only changes
  through `npm run helm:add`. See [How the kit is built on Spartan](AGENTS.md#how-the-kit-is-built-on-spartan).
- **Every public part has a doc comment and an example.** The docs are generated from them, and
  `npm run docs:emit -- --check` fails without them.
- **Write as [docs/writing.md](docs/writing.md) says, with the [glossary](docs/glossary.md)'s
  names.** American English; `npm run test:tools` catches the British spellings.

## Add a component

1. Create its entry point, `projects/neat-ui/<name>/`, as the existing ones are, and register it
   in the places [AGENTS.md lists](AGENTS.md#what-this-repo-is) ("To add an entry point").
2. Build the component on Spartan's brain primitive where one exists, with the kit's look from
   helm's classes ([how](AGENTS.md#how-the-kit-is-built-on-spartan)).
3. Give every public part, input, model and output a doc comment.
4. Add a topic for it in `projects/showcase/src/app/docs/topics.ts`, and examples in
   `projects/showcase/src/app/examples/<topic>/`, one `*.example.ts` each. The class doc is the
   example's caption.
5. Run `npm run docs:emit` and `npm run docs:pages`, then look at the topic in the showcase in both
   themes.
6. If an example makes a good picture for the README's gallery, mark it `@gallery` (one per
   topic), then run `npm run docs:capture -- --gallery` and `npm run docs:gallery`.

## Docs and pictures

- `npm run docs:emit` writes the showcase's docs from the kit's source and the examples. The
  output is committed; never edit it.
- `npm run docs:capture` builds the showcase and takes a picture of each example, light and dark,
  into `docs/images`. `-- --gallery` takes only the README gallery's pictures. An example whose
  content opens in an overlay says what to click with `@capture click <selector>`. An example
  whose point is motion (a live chart) is marked `@animated`, and is also taken as an animation,
  which the docs show in its picture's place; `-- --only animations` takes only those.
- `npm run docs:pages` writes the Markdown docs, `docs/README.md` and a page per topic, from the
  same sources as the showcase. Never edit them; their check runs in `npm run test:tools`.
- `npm run docs:gallery` writes the README's gallery from the `@gallery` examples. Its check runs
  in `npm run test:tools`.

## Before a pull request

Run lint, the tests and the three builds; CI runs the same.

```bash
npm run lint
npm test -- --watch=false
npm run test:tools
npm run build && npm run check:dist
npm run build:showcase
npm run bench:build
```

## Release

A release is a version bump, a packed tarball and a GitHub release that carries it. Apps never
build the kit; they keep the released tarball in their repository.

1. Bump `version` in `projects/neat-ui/package.json`. The root `package.json` stays at `0.0.0`: it
   is the workspace, not the package.
2. Run `npm test -- --watch=false && npm run lint`, then `npm run pack`. It builds the kit and its
   stylesheet, runs `check:dist` and writes `dist/neat-ui/sima-neat-ui-<version>.tgz`. Inspect it
   with `tar -tzf`: it holds one FESM bundle per entry point (`fesm2022/sima-neat-ui.mjs` and
   `fesm2022/sima-neat-ui-<name>.mjs`), the types, `styles/neat-ui.css` and
   `styles/neat-ui.tailwind.css`. Every build empties `dist/neat-ui`, tarball included, so the
   GitHub release (step 6) is the tarball's lasting home, not the checkout.
3. Retake the pictures, `npm run docs:capture`, then `npm run docs:pages`, and commit what
   changed.
4. Commit the bump as `Release neat-ui <version>` and tag it `v<version>`.
5. Push with the tag: `git push --follow-tags`.
6. Create the GitHub release with the tarball attached:

   ```bash
   gh release create v<version> dist/neat-ui/sima-neat-ui-<version>.tgz \
     --title "neat-ui <version>" --notes "<what changed>"
   ```

7. Put the tarball into each app, as `insight-next`'s `AGENTS.md` describes: copy it into the
   app's `frontend/vendor/`, run `npm install ./vendor/sima-neat-ui-<version>.tgz` there, remove
   the previous tarball and commit the new one with the lockfile. Apps commit the tarball, never a
   path into a local checkout of the kit.

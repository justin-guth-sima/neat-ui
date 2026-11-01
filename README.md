# neat-ui

SiMa.ai-branded Angular UI kit for Neat applications. It builds a themed, opinionated component set
on Spartan UI (headless brain primitives plus its helm styles, Tailwind inside the kit only) so that
apps such as Neat Insight get one consistent look and one place to change it. Apps use only the
kit's `neat-*` API and its prebuilt stylesheet; they need no Tailwind of their own.

- `projects/neat-ui`: the library, published as `@sima/neat-ui`. The primary entry point holds
  what the shell and every page need; every other component has its own entry point, imported as
  `@sima/neat-ui/<name>` (`@sima/neat-ui/dialog`, `@sima/neat-ui/select-list`, …), so an app's
  main bundle carries only the entries its shell imports. AGENTS.md lists them.
- `projects/showcase`: the kit's docs, every part with live examples and its API in both themes.
  Look here before building something new.
- `projects/bench`: the rendering bench, which measures how much diagram a machine draws smoothly
  with the kit and with ngx-vflow. Never published.

Contributors, human or agent: read [AGENTS.md](AGENTS.md) first.

## Develop

Requires Node 24 (see `.node-version`).

```bash
npm ci
npm start       # showcase dev server
npm test        # unit tests (Vitest)
npm run lint    # ESLint + Stylelint
npm run build   # library, into dist/neat-ui
npm run pack    # build, then write dist/neat-ui/sima-neat-ui-<version>.tgz
```

## Consume

Apps install the packed tarball:

```bash
npm install ../neat-ui/dist/neat-ui/sima-neat-ui-<version>.tgz
```

## Release

A release is a version bump, a packed tarball and a GitHub release that carries it. Consumers never
build the kit; they vendor the released tarball.

1. Bump `version` in `projects/neat-ui/package.json` (the root `package.json` stays at `0.0.0`; it
   is the workspace, not the package).
2. Run `npm test -- --watch=false && npm run lint`, then `npm run pack`. It builds the library and
   its stylesheet, runs `check:dist` and writes `dist/neat-ui/sima-neat-ui-<version>.tgz`. Inspect
   it with `tar -tzf`: it holds one FESM bundle per entry point (`fesm2022/sima-neat-ui.mjs` and
   `fesm2022/sima-neat-ui-<name>.mjs`), the types, `styles/neat-ui.css` and
   `styles/neat-ui.tailwind.css`. Every build empties `dist/neat-ui`, tarball included, so the
   GitHub release (step 5) is the tarball's durable home, not the checkout.
3. Commit the bump as `Release neat-ui <version>` and tag it `v<version>`.
4. Push with the tag: `git push --follow-tags`.
5. Create the GitHub release with the tarball attached:

   ```bash
   gh release create v<version> dist/neat-ui/sima-neat-ui-<version>.tgz \
     --title "neat-ui <version>" --notes "<what changed>"
   ```

6. Vendor the tarball into each consumer, as `insight-next`'s `AGENTS.md` describes: copy it into
   the app's `frontend/vendor/`, run `npm install ./vendor/sima-neat-ui-<version>.tgz` there, remove
   the previous tarball and commit the new one with the lockfile. Consumers commit a vendored
   tarball, never a path into a local kit checkout.

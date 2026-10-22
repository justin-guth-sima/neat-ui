# neat-ui

SiMa.ai-branded Angular UI kit for Neat applications. It builds a themed, opinionated component set
on Spartan UI (headless brain primitives plus its helm styles, Tailwind inside the kit only) so that
apps such as Neat Insight get one consistent look and one place to change it. Apps use only the
kit's `neat-*` API and its prebuilt stylesheet; they need no Tailwind of their own.

- `projects/neat-ui`: the library, published as `@sima/neat-ui`.
- `projects/showcase`: a gallery of every component in both themes. Look here before building
  something new.

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

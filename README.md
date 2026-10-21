# neat-ui

SiMa.ai-branded Angular UI kit for Neat applications. It wraps PrimeNG behind a themed, opinionated
component set so that apps such as Neat Insight get one consistent look and one place to change it.

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
npm run pack    # build, then write dist/sima-neat-ui-<version>.tgz
```

## Consume

Apps install the packed tarball:

```bash
npm install ../neat-ui/dist/sima-neat-ui-<version>.tgz
```

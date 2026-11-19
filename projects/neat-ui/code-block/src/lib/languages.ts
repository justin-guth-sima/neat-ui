import { inject, InjectionToken, type Provider } from '@angular/core';

/**
 * The languages a code block can color, by the name its `language` takes: for each, a function
 * that imports the language's grammar.
 *
 * Each import names a grammar module of Shiki's `@shikijs/langs` package (the kit installs it with
 * its highlighter), as a dynamic `import()`, so the grammar loads only when a block shows that
 * language:
 *
 * ```ts
 * const languages: NeatCodeLanguages = {
 *   rust: () => import('@shikijs/langs/rust'),
 *   toml: () => import('@shikijs/langs/toml'),
 * };
 * ```
 *
 * A module's default export is the language's grammar after those it embeds, as `@shikijs/langs`
 * gives it. A static import would put the grammar in the bundle of every page that imports the
 * file.
 */
export type NeatCodeLanguages = Readonly<
  Record<string, () => Promise<{ readonly default: readonly object[] }>>
>;

/**
 * Adds languages to the ones a code block colors by itself, or gives one another grammar.
 *
 * ```ts
 * providers: [
 *   provideNeatCodeLanguages({
 *     rust: () => import('@shikijs/langs/rust'),
 *     rs: () => import('@shikijs/langs/rust'),
 *   }),
 * ],
 * ```
 *
 * Each key is a name a block's `language` takes, so a language used by two names (its id and an
 * alias) is listed under both. The kit colors Python, C++, C, shell, JSON, YAML, CMake,
 * TypeScript, JavaScript, HTML, CSS, Markdown, Dockerfile and Go without it.
 *
 * It goes in any `providers`: the app's `app.config.ts` for every page, a route's for the pages
 * under it, a component's for the blocks in its template. Each adds to the languages of the place
 * around it, so a page's languages come on top of the app's. Within one `providers` list, call it
 * once with all of that place's languages: a second call there replaces the first.
 */
export function provideNeatCodeLanguages(languages: NeatCodeLanguages): Provider {
  return {
    provide: NEAT_CODE_LANGUAGES,
    useFactory: (): NeatCodeLanguages => ({
      ...(inject(NEAT_CODE_LANGUAGES, { optional: true, skipSelf: true }) ??
        DEFAULT_CODE_LANGUAGES),
      ...languages,
    }),
  };
}

const python = () => import('@shikijs/langs/python');
const cpp = () => import('@shikijs/langs/cpp');
const shell = () => import('@shikijs/langs/shellscript');
const yaml = () => import('@shikijs/langs/yaml');
const typescript = () => import('@shikijs/langs/typescript');
const javascript = () => import('@shikijs/langs/javascript');
const markdown = () => import('@shikijs/langs/markdown');
const docker = () => import('@shikijs/langs/docker');

/**
 * The languages a code block colors by itself, under each grammar's Shiki name and aliases (the
 * spec holds the names to the grammars). Their grammars are MIT licensed but YAML's, whose
 * TextMate bundle grants every use without conditions; C++'s embeds GLSL's, which states no
 * license (AGENTS.md "How the code block colors code").
 */
export const DEFAULT_CODE_LANGUAGES: NeatCodeLanguages = {
  python,
  py: python,
  cpp,
  'c++': cpp,
  c: () => import('@shikijs/langs/c'),
  shellscript: shell,
  bash: shell,
  sh: shell,
  shell,
  zsh: shell,
  json: () => import('@shikijs/langs/json'),
  yaml,
  yml: yaml,
  cmake: () => import('@shikijs/langs/cmake'),
  typescript,
  ts: typescript,
  cts: typescript,
  mts: typescript,
  javascript,
  js: javascript,
  cjs: javascript,
  mjs: javascript,
  html: () => import('@shikijs/langs/html'),
  css: () => import('@shikijs/langs/css'),
  markdown,
  md: markdown,
  docker,
  dockerfile: docker,
  go: () => import('@shikijs/langs/go'),
};

/**
 * The languages the code blocks here color: the kit's own, and those `provideNeatCodeLanguages`
 * added on the way (which win).
 */
export const NEAT_CODE_LANGUAGES = new InjectionToken<NeatCodeLanguages>(
  'neat-ui: the languages code blocks color',
  { providedIn: 'root', factory: () => DEFAULT_CODE_LANGUAGES },
);

// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/** Fails an import of d3 or a d3 package other than `allowed` (each by its exact name). */
function d3Pattern(allowed) {
  const except = allowed.length ? `(?!(${allowed.join('|')})$)` : '';
  return {
    regex: `^${except}d3(-|/|$)`,
    message:
      'Only the charts entry (d3-scale, d3-shape) and the diagram entry (d3-zoom, d3-selection) import d3; draw through the components of @sima/neat-ui/charts and @sima/neat-ui/diagram.',
  };
}

/**
 * The bench's own dev dependencies (AGENTS.md "The rendering bench"): ngx-vflow, the renderer it
 * compares with, and Playwright and source-map, which its harness runs on. `playwright-core` is
 * what `playwright` wraps, so importing it directly would step around the rule. `d3-drag` (vflow's
 * peer) is bench-only too, but it is d3, which `d3Pattern` already fails outside the bench. sharp
 * is the docs' capture tool's (`tools/docs-capture.mjs`), which ESLint does not read; it is here so
 * that the kit and the showcase cannot take it up either.
 * ESLint sees static imports only: a dynamic `import()` is not caught here, and `check:dist` (which
 * reads the built package) is the only guard against one.
 */
const BENCH_ONLY = {
  regex: '^(ngx-vflow|playwright(-core)?|source-map|sharp)(/|$)',
  message:
    'ngx-vflow, Playwright, source-map and sharp are dev dependencies of the rendering bench and the docs tools, importable only under projects/bench/ (sharp only in tools/); the kit and its apps never ship them.',
};

/**
 * Lucide's tags (`lucide-static`'s tags.json) are the showcase's icon finder's data: a dev
 * dependency importable only under projects/showcase/; the kit ships `lucide` alone.
 */
const SHOWCASE_ONLY = {
  regex: '^lucide-static(/|$)',
  message:
    "lucide-static is a dev dependency of the showcase's icon finder, importable only under projects/showcase/; the kit and its apps never ship it.",
};

/**
 * The diagram entry's bench seam (`projects/neat-ui/diagram/src/bench-seam.ts`, AGENTS.md "The
 * rendering bench"): its internals as the bench needs them, an agreed exception that only the bench
 * may use, through the alias its tsconfig declares. Matched by the alias and by any relative path
 * ending in the file's name (with or without its extension), so the diagram's own public API cannot
 * re-export it either.
 */
const SEAM_FILE = '(^|/)bench-seam(\\.[jt]s)?$';
const SEAM = {
  regex: `^@bench/diagram-seam$|${SEAM_FILE}`,
  message:
    "The diagram's bench seam exposes its internals to the rendering bench alone: importable only under projects/bench/, and never exported by the kit.",
};
/** Inside the bench: through the alias only, so there is one way in to look for. */
const SEAM_BY_ALIAS = {
  regex: SEAM_FILE,
  message: "Import the diagram's bench seam through its alias, '@bench/diagram-seam'.",
};

/**
 * Shiki, the code block's highlighter (AGENTS.md "How the code block colors code"): its packages
 * reach an app only through the code-block entry's dynamic `import()`s, so a page without a colored
 * block loads none of it. A static import would put Shiki, or a grammar, in the bundle of every
 * page that imports the file. The code-block entry may import Shiki's types, which compile away;
 * an app adds a grammar with a dynamic import, which this rule does not see.
 */
const SHIKI_PATTERN = '^(shiki|@shikijs/[^/]+)(/|$)';
const SHIKI = {
  regex: SHIKI_PATTERN,
  message:
    "Shiki is loaded by @sima/neat-ui/code-block alone, through dynamic import(); color code with neat-code-block's language, and add a grammar as () => import('@shikijs/langs/<id>').",
};
const SHIKI_TYPES_ONLY = {
  regex: SHIKI_PATTERN,
  allowTypeImports: true,
  message:
    "The code block loads Shiki through dynamic import() only, so no page carries it before a colored block needs it; import its types with 'import type'.",
};

/** marked, the Markdown lexer: the markdown entry's own, so a page carries it only with that entry. */
const MARKED = {
  regex: '^marked(/|$)',
  message: 'marked is imported by @sima/neat-ui/markdown alone; show Markdown with neat-markdown.',
};

/**
 * The import rule for the kit's files: d3 but `allowed`, nothing bench- or showcase-only, no seam,
 * Shiki as `shiki` says (none outside the code-block entry) and marked as `marked` says (none
 * outside the markdown entry, where it is null).
 */
const kitImports = (allowed, { shiki = SHIKI, marked = MARKED } = {}) => [
  'error',
  {
    patterns: [d3Pattern(allowed), BENCH_ONLY, SEAM, SHOWCASE_ONLY, shiki, marked].filter(Boolean),
  },
];

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // Component styles live in .css files (styleUrl) because Stylelint reads only stylesheets:
      // an inline `styles` block would escape the color-literal rules. Inline templates stay
      // allowed at any length; the rule has no off switch per kind, hence the unreachable limit.
      '@angular-eslint/component-max-inline-declarations': [
        'error',
        { template: Number.MAX_SAFE_INTEGER, styles: 0 },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'neat',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'neat',
          style: 'kebab-case',
        },
      ],
    },
  },
  // d3 belongs to three entries, each to its own packages (AGENTS.md "d3 belongs to three
  // entries"): `charts` to d3-scale and d3-shape, `diagram` and `bev` to d3-zoom and d3-selection
  // (both pan and zoom with it); every other part of
  // the kit, and every app that takes the kit's config, draws through those entries' components.
  // The bench's dev dependencies and the diagram's bench seam are importable under projects/bench/
  // only, where d3-drag is the one d3 package allowed (vflow's peer). It is the typescript-eslint
  // rule, not core `no-restricted-imports`, on purpose: ESLint replaces a rule's options wholesale
  // when a later block sets the same rule for a file, so these blocks would silently switch off the
  // kit's entry-direction rules in `projects/neat-ui/eslint.config.js`
  // (tools/lint-boundaries.test.mjs checks that all of them still fire). The six blocks match
  // disjoint files for the same reason, which is also why each states every boundary in one rule.
  // Shiki is the code-block entry's alone, and there only through dynamic imports and type imports.
  {
    files: ['**/*.ts'],
    ignores: [
      'projects/neat-ui/charts/**',
      'projects/neat-ui/diagram/**',
      'projects/neat-ui/bev/**',
      'projects/neat-ui/code-block/**',
      'projects/neat-ui/markdown/**',
      'projects/bench/**',
      'projects/showcase/**',
    ],
    rules: { '@typescript-eslint/no-restricted-imports': kitImports([]) },
  },
  {
    // The showcase is an app of the kit's, with its icon finder's tags on top.
    files: ['projects/showcase/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [d3Pattern([]), BENCH_ONLY, SEAM, SHIKI, MARKED] },
      ],
    },
  },
  {
    files: ['projects/neat-ui/charts/**/*.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': kitImports(['d3-scale', 'd3-shape']) },
  },
  {
    // The diagram and the bird's-eye view pan and zoom with d3-zoom, on the same terms.
    files: ['projects/neat-ui/diagram/**/*.ts', 'projects/neat-ui/bev/**/*.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': kitImports(['d3-zoom', 'd3-selection']) },
  },
  {
    files: ['projects/neat-ui/code-block/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': kitImports([], { shiki: SHIKI_TYPES_ONLY }),
    },
  },
  {
    files: ['projects/neat-ui/markdown/**/*.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': kitImports([], { marked: null }) },
  },
  {
    files: ['projects/bench/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [d3Pattern(['d3-drag']), SEAM_BY_ALIAS, SHOWCASE_ONLY, SHIKI, MARKED] },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);

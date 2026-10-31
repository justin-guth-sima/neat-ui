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
 * peer) is bench-only too, but it is d3, which `d3Pattern` already fails outside the bench.
 * ESLint sees static imports only: a dynamic `import()` is not caught here, and `check:dist` (which
 * reads the built package) is the only guard against one.
 */
const BENCH_ONLY = {
  regex: '^(ngx-vflow|playwright(-core)?|source-map)(/|$)',
  message:
    "ngx-vflow, Playwright and source-map are the rendering bench's dev dependencies, importable only under projects/bench/; the kit and its apps never ship them.",
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

/** The import rule for files outside the bench: d3 but `allowed`, nothing bench-only, no seam. */
const kitImports = (allowed) => ['error', { patterns: [d3Pattern(allowed), BENCH_ONLY, SEAM] }];

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
      // an inline `styles` block would escape the colour-literal rules. Inline templates stay
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
  // d3 belongs to two entries, each to its own packages (AGENTS.md "d3 belongs to two entries"):
  // `charts` to d3-scale and d3-shape, `diagram` to d3-zoom and d3-selection; every other part of
  // the kit, and every app that takes the kit's config, draws through those entries' components.
  // The bench's dev dependencies and the diagram's bench seam are importable under projects/bench/
  // only, where d3-drag is the one d3 package allowed (vflow's peer). It is the typescript-eslint
  // rule, not core `no-restricted-imports`, on purpose: ESLint replaces a rule's options wholesale
  // when a later block sets the same rule for a file, so these blocks would silently switch off the
  // kit's entry-direction rules in `projects/neat-ui/eslint.config.js`
  // (tools/lint-boundaries.test.mjs checks that all of them still fire). The four blocks match
  // disjoint files for the same reason, which is also why each states both boundaries in one rule.
  {
    files: ['**/*.ts'],
    ignores: ['projects/neat-ui/charts/**', 'projects/neat-ui/diagram/**', 'projects/bench/**'],
    rules: { '@typescript-eslint/no-restricted-imports': kitImports([]) },
  },
  {
    files: ['projects/neat-ui/charts/**/*.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': kitImports(['d3-scale', 'd3-shape']) },
  },
  {
    files: ['projects/neat-ui/diagram/**/*.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': kitImports(['d3-zoom', 'd3-selection']) },
  },
  {
    files: ['projects/bench/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [d3Pattern(['d3-drag']), SEAM_BY_ALIAS] },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);

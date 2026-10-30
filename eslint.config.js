// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/** Fails an import of d3 or a d3 package other than `allowed` (each by its exact name). */
function d3Rule(allowed) {
  const except = allowed.length ? `(?!(${allowed.join('|')})$)` : '';
  return [
    'error',
    {
      patterns: [
        {
          regex: `^${except}d3(-|/|$)`,
          message:
            'Only the charts entry (d3-scale, d3-shape) and the diagram entry (d3-zoom, d3-selection) import d3; draw through the components of @sima/neat-ui/charts and @sima/neat-ui/diagram.',
        },
      ],
    },
  ];
}

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
  // It is the typescript-eslint rule, not core `no-restricted-imports`, on purpose: ESLint replaces
  // a rule's options wholesale when a later block sets the same rule for a file, so these blocks
  // would silently switch off the kit's entry-direction rules in
  // `projects/neat-ui/eslint.config.js` (tools/lint-boundaries.test.mjs checks that both still
  // fire). The three blocks match disjoint files for the same reason.
  {
    files: ['**/*.ts'],
    ignores: ['projects/neat-ui/charts/**', 'projects/neat-ui/diagram/**'],
    rules: { '@typescript-eslint/no-restricted-imports': d3Rule([]) },
  },
  {
    files: ['projects/neat-ui/charts/**/*.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': d3Rule(['d3-scale', 'd3-shape']) },
  },
  {
    files: ['projects/neat-ui/diagram/**/*.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': d3Rule(['d3-zoom', 'd3-selection']) },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);

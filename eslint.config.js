// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

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
  {
    // d3 is the charts entry's alone (AGENTS.md "How the charts are drawn"): every other part of the
    // kit, and every app that takes the kit's config, draws through `@sima/neat-ui/charts`. It is
    // the typescript-eslint rule, not core `no-restricted-imports`, on purpose: ESLint replaces a
    // rule's options wholesale when a later block sets the same rule for a file, so this block
    // would silently switch off the kit's entry-direction rules in `projects/neat-ui/eslint.config.js`
    // (tools/lint-boundaries.test.mjs checks that both still fire).
    files: ['**/*.ts'],
    ignores: ['projects/neat-ui/charts/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^d3(-|/|$)',
              message:
                'Only projects/neat-ui/charts/ imports d3; draw charts with the components of @sima/neat-ui/charts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);

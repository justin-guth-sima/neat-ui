// @ts-check
const { defineConfig } = require('eslint/config');
const rootConfig = require('../../eslint.config.js');

module.exports = defineConfig([
  ...rootConfig,
  {
    files: ['**/*.ts'],
    rules: {
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
    files: ['**/*.html'],
    rules: {},
  },
  {
    // The entry points depend one way (AGENTS.md): video reaches the primary only through the
    // package name, never by a relative path, which ng-packagr would resolve into a copy of the
    // primary inside the video bundle. The pattern is matched against the import text, not a
    // resolved path, so it targets the one shape such a path has: climbing out to a `src` folder
    // (video code never needs to climb out of `video/src` and back into a `src` folder).
    files: ['projects/neat-ui/video/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(\\.\\./)+src/',
              message:
                "Import the primary entry point as '@sima/neat-ui', not by a relative path across the boundary.",
            },
          ],
        },
      ],
    },
  },
  {
    // The other half: the primary never imports video code, by relative path or by package name
    // (the latter is a cycle ng-packagr rejects, but only after the build has started).
    files: ['projects/neat-ui/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(\\.\\./)+video/|^@sima/neat-ui/video(/|$)',
              message: 'The primary entry point must not import from @sima/neat-ui/video.',
            },
          ],
        },
      ],
    },
  },
  {
    // Vendored Spartan helm (npm run helm:add): internal, never exported, and kept as generated so
    // updates stay mechanical. Its hlm selectors, `class` input aliases, type aliases and
    // `ReadonlyArray` are upstream style. The paginated tab list handles keys on the container of
    // its tabs, which take the focus (interactive-supports-focus cannot see that). Every other
    // rule still applies. The glob is relative to the workspace root, where `ng lint` runs.
    files: ['projects/neat-ui/src/lib/ui/**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': 'off',
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/no-input-rename': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/array-type': 'off',
    },
  },
  {
    // Helm's inline templates, which the template processor lints as virtual .html files.
    files: ['projects/neat-ui/src/lib/ui/**/*.html'],
    rules: {
      '@angular-eslint/template/interactive-supports-focus': 'off',
    },
  },
]);

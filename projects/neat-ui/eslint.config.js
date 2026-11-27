// @ts-check
const { defineConfig } = require('eslint/config');
const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const rootConfig = require('../../eslint.config.js');

// The secondary entry points: the folders beside `src` that hold an ng-package.json. Read from the
// disk so that a new entry is covered by the direction rules below the moment it exists.
const ENTRIES = readdirSync(__dirname, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && existsSync(join(__dirname, entry.name, 'ng-package.json')),
  )
  .map((entry) => entry.name);
const SECONDARY_GLOBS = ENTRIES.map((name) => `projects/neat-ui/${name}/**/*.ts`);
const SECONDARY_SPEC_GLOBS = ENTRIES.map((name) => `projects/neat-ui/${name}/**/*.spec.ts`);
/** An import climbing out of an entry to the primary's `src` or another entry's `<name>/src`. */
const leavesEntry = (except = '') => `^(\\.\\./)+${except}(src/|(${ENTRIES.join('|')})/src/)`;
const BY_PACKAGE_NAME =
  "Import the primary and other entry points by package name ('@sima/neat-ui', '@sima/neat-ui/<name>'), not by a relative path across the boundary.";

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
    // The entry points depend one way (AGENTS.md): a secondary entry reaches the primary and the
    // other entries only through the package name, never by a relative path, which ng-packagr would
    // resolve into a copy of that code inside the entry's bundle. The pattern is matched against
    // the import text, not a resolved path, so it targets the shapes such a path has: climbing out
    // to the primary's `src` folder, or to another entry's `<name>/src` (an entry's code never
    // needs to climb out of its own `src` and back into one).
    files: SECONDARY_GLOBS,
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ regex: leavesEntry(), message: BY_PACKAGE_NAME }],
        },
      ],
    },
  },
  {
    // Specs are not packaged, so the build cannot copy anything through them, but the rule stands
    // for them except where a spec has no other way: the primary's theme helpers that are not
    // exported (`spartanThemeTokens`, `stateColor`, the contrast rules) and the vendored helm
    // source its drift checks read as text (`?source`). Those two folders may be imported by
    // relative path; everything else goes through the package name.
    files: SECONDARY_SPEC_GLOBS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: leavesEntry('(?!src/lib/(theme|ui)/)'),
              message: `${BY_PACKAGE_NAME} Only src/lib/theme/ and src/lib/ui/ may be imported by a relative path, from a spec.`,
            },
          ],
        },
      ],
    },
  },
  {
    // The other half: the primary never imports a secondary entry, by relative path or by package
    // name (the latter is a cycle ng-packagr rejects, but only after the build has started). Its
    // public-api.spec is the one file that must: it compares the primary with every entry.
    files: ['projects/neat-ui/src/**/*.ts'],
    ignores: ['**/public-api.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `^(\\.\\./)+(${ENTRIES.join('|')})/src/|^@sima/neat-ui/`,
              message: 'The primary entry point must not import from a @sima/neat-ui/<name> entry.',
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
    // Helm's own disable comments target rules this block turns off, and the code stays as
    // generated, so unused disable directives are not reported here.
    files: ['projects/neat-ui/src/lib/ui/**/*.ts'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
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

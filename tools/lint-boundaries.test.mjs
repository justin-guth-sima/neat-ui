// The kit's lint rules are what hold its import boundaries (AGENTS.md), and ESLint replaces a
// rule's options wholesale when a later config block sets the same rule for the same file. So a
// block added for one boundary can silently switch another off. These tests run the real configs
// over sample source and check that every boundary still fires where it should and stays quiet
// where it should.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const KIT_CONFIG = 'projects/neat-ui/eslint.config.js';
const SHOWCASE_CONFIG = 'projects/showcase/eslint.config.js';

const linters = new Map();
/** The messages ESLint gives `code` as if it were the file at `filePath` (relative to the repo). */
async function lint(config, filePath, code) {
  if (!linters.has(config)) {
    linters.set(config, new ESLint({ cwd: ROOT, overrideConfigFile: config }));
  }
  const [result] = await linters.get(config).lintText(code, { filePath });
  return result.messages;
}

/** The messages of the import-boundary rules only: the sample code is not otherwise tidy. */
async function boundaryMessages(config, filePath, code) {
  const messages = await lint(config, filePath, code);
  return messages.filter((message) => /no-restricted-imports$/.test(message.ruleId ?? ''));
}

const D3_IMPORTS = [
  "import { scaleLinear } from 'd3-scale';\nexport const scale = scaleLinear;\n",
  "import type { ScaleLinear } from 'd3-scale';\nexport type Scale = ScaleLinear<number, number>;\n",
  "export { line } from 'd3-shape';\n",
  "import { interpolate } from 'd3-interpolate';\nexport const mix = interpolate;\n",
  "import * as d3 from 'd3';\nexport const all = d3;\n",
  "import { path } from 'd3-path/src/path.js';\nexport const draw = path;\n",
];

test('d3 is importable from the charts entry only', async () => {
  const outside = [
    [KIT_CONFIG, 'projects/neat-ui/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/level-meter/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/level-meter/src/lib/x.spec.ts'],
    [SHOWCASE_CONFIG, 'projects/showcase/src/app/x.ts'],
  ];
  for (const [config, filePath] of outside) {
    for (const code of D3_IMPORTS) {
      const messages = await boundaryMessages(config, filePath, code);
      assert.equal(messages.length, 1, `${filePath}: ${code}`);
      assert.match(messages[0].message, /charts/, filePath);
    }
  }
  for (const filePath of [
    'projects/neat-ui/charts/src/lib/x.ts',
    'projects/neat-ui/charts/src/lib/x.spec.ts',
  ]) {
    for (const code of D3_IMPORTS) {
      assert.deepEqual(
        await boundaryMessages(KIT_CONFIG, filePath, code),
        [],
        `${filePath}: ${code}`,
      );
    }
  }
});

test('a package that only starts with d3 is not d3', async () => {
  const code = "import { x } from 'd3rive';\nexport const y = x;\n";
  assert.deepEqual(await boundaryMessages(KIT_CONFIG, 'projects/neat-ui/src/lib/x.ts', code), []);
});

test('the direction rules still fire beside the d3 rule, in the charts entry too', async () => {
  const climbs = "import { x } from '../../../src/lib/theme/color';\nexport const y = x;\n";
  for (const filePath of [
    'projects/neat-ui/level-meter/src/lib/x.ts',
    'projects/neat-ui/charts/src/lib/x.ts',
  ]) {
    const messages = await boundaryMessages(KIT_CONFIG, filePath, climbs);
    assert.equal(messages.length, 1, filePath);
    assert.match(messages[0].message, /package name/, filePath);
  }
  const intoEntry = "import { x } from '@sima/neat-ui/charts';\nexport const y = x;\n";
  const messages = await boundaryMessages(KIT_CONFIG, 'projects/neat-ui/src/lib/x.ts', intoEntry);
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /primary entry point/);
});

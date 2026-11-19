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
const BENCH_CONFIG = 'projects/bench/eslint.config.js';

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

/** A sample importing `specifier`, the way the kit's code does. */
const importOf = (specifier) => `import * as d3 from '${specifier}';\nexport const all = d3;\n`;

/** Each entry's own d3 packages, and what every other d3 import looks like. */
const CHARTS_D3 = [
  "import { scaleLinear } from 'd3-scale';\nexport const scale = scaleLinear;\n",
  "import type { ScaleLinear } from 'd3-scale';\nexport type Scale = ScaleLinear<number, number>;\n",
  "export { line } from 'd3-shape';\n",
];
const DIAGRAM_D3 = [
  "import { zoom } from 'd3-zoom';\nexport const behavior = zoom;\n",
  "import type { ZoomTransform } from 'd3-zoom';\nexport type Transform = ZoomTransform;\n",
  "export { select } from 'd3-selection';\n",
];
const OTHER_D3 = [
  "import { interpolate } from 'd3-interpolate';\nexport const mix = interpolate;\n",
  importOf('d3'),
  importOf('d3-transition'),
  "import { path } from 'd3-path/src/path.js';\nexport const draw = path;\n",
  importOf('d3-shape/src/line.js'),
  importOf('d3-zoom/src/zoom.js'),
];

/** Lints each sample as `filePath`: one d3 message each when `fires`, none when not. */
async function expectD3Rule(config, filePath, samples, fires) {
  for (const code of samples) {
    const messages = await boundaryMessages(config, filePath, code);
    if (!fires) {
      assert.deepEqual(messages, [], `${filePath}: ${code}`);
      continue;
    }
    assert.equal(messages.length, 1, `${filePath}: ${code}`);
    assert.match(messages[0].message, /charts.*diagram/, filePath);
  }
}

test('d3 is importable from the charts and diagram entries only', async () => {
  const outside = [
    [KIT_CONFIG, 'projects/neat-ui/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/level-meter/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/level-meter/src/lib/x.spec.ts'],
    [SHOWCASE_CONFIG, 'projects/showcase/src/app/x.ts'],
  ];
  for (const [config, filePath] of outside) {
    await expectD3Rule(config, filePath, [...CHARTS_D3, ...DIAGRAM_D3, ...OTHER_D3], true);
  }
});

test('the charts entry imports d3-scale and d3-shape, and no other d3', async () => {
  for (const filePath of [
    'projects/neat-ui/charts/src/lib/x.ts',
    'projects/neat-ui/charts/src/lib/x.spec.ts',
  ]) {
    await expectD3Rule(KIT_CONFIG, filePath, CHARTS_D3, false);
    await expectD3Rule(KIT_CONFIG, filePath, [...DIAGRAM_D3, ...OTHER_D3], true);
  }
});

test('the diagram entry imports d3-zoom and d3-selection, and no other d3', async () => {
  for (const filePath of [
    'projects/neat-ui/diagram/src/lib/x.ts',
    'projects/neat-ui/diagram/src/lib/x.spec.ts',
  ]) {
    await expectD3Rule(KIT_CONFIG, filePath, DIAGRAM_D3, false);
    await expectD3Rule(KIT_CONFIG, filePath, [...CHARTS_D3, ...OTHER_D3], true);
  }
});

test('a package that only starts with d3 is not d3', async () => {
  const code = "import { x } from 'd3rive';\nexport const y = x;\n";
  assert.deepEqual(await boundaryMessages(KIT_CONFIG, 'projects/neat-ui/src/lib/x.ts', code), []);
});

test('the direction rules still fire beside the d3 rule, in the d3 entries too', async () => {
  const climbs = "import { x } from '../../../src/lib/theme/color';\nexport const y = x;\n";
  for (const filePath of [
    'projects/neat-ui/level-meter/src/lib/x.ts',
    'projects/neat-ui/charts/src/lib/x.ts',
    'projects/neat-ui/diagram/src/lib/x.ts',
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

/** The bench's dev dependencies as its code and harness would import them. */
const BENCH_ONLY = [
  "import { Vflow } from 'ngx-vflow';\nexport const flow = Vflow;\n",
  "import type { Node } from 'ngx-vflow';\nexport type N = Node;\n",
  "import { chromium } from 'playwright';\nexport const browser = chromium;\n",
  importOf('playwright-core'),
  importOf('playwright/test'),
  "import { SourceMapConsumer } from 'source-map';\nexport const maps = SourceMapConsumer;\n",
  importOf('source-map/lib/util.js'),
  "import sharp from 'sharp';\nexport const encode = sharp;\n",
];
const D3_DRAG = "import { drag } from 'd3-drag';\nexport const behavior = drag;\n";

test('the bench’s dev dependencies are importable under projects/bench/ only', async () => {
  for (const [config, filePath] of [
    [KIT_CONFIG, 'projects/neat-ui/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/level-meter/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/charts/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/diagram/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/diagram/src/lib/x.spec.ts'],
    [SHOWCASE_CONFIG, 'projects/showcase/src/app/x.ts'],
  ]) {
    for (const code of BENCH_ONLY) {
      const messages = await boundaryMessages(config, filePath, code);
      assert.equal(messages.length, 1, `${filePath}: ${code}`);
      assert.match(messages[0].message, /projects\/bench/, `${filePath}: ${code}`);
    }
    // d3-drag is d3, which the d3 rule already fails, once, outside the bench.
    const messages = await boundaryMessages(config, filePath, D3_DRAG);
    assert.equal(messages.length, 1, filePath);
    assert.match(messages[0].message, /charts.*diagram/, filePath);
  }
  for (const filePath of ['projects/bench/src/app/x.ts', 'projects/bench/src/app/x.spec.ts']) {
    for (const code of [...BENCH_ONLY, D3_DRAG]) {
      assert.deepEqual(await boundaryMessages(BENCH_CONFIG, filePath, code), [], code);
    }
  }
});

test('the bench, like any app, imports no d3 but vflow’s d3-drag', async () => {
  await expectD3Rule(
    BENCH_CONFIG,
    'projects/bench/src/app/x.ts',
    [...CHARTS_D3, ...DIAGRAM_D3, ...OTHER_D3],
    true,
  );
});

/** Lucide's tags, as the showcase's icon finder imports them. */
const SHOWCASE_ONLY = [
  "import tags from 'lucide-static/tags.json';\nexport const t = tags;\n",
  importOf('lucide-static'),
];

test('lucide-static is importable under projects/showcase/ only', async () => {
  for (const [config, filePath] of [
    [KIT_CONFIG, 'projects/neat-ui/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/lucide/src/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/charts/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/diagram/src/lib/x.ts'],
    [BENCH_CONFIG, 'projects/bench/src/app/x.ts'],
  ]) {
    for (const code of SHOWCASE_ONLY) {
      const messages = await boundaryMessages(config, filePath, code);
      assert.equal(messages.length, 1, `${filePath}: ${code}`);
      assert.match(messages[0].message, /projects\/showcase/, `${filePath}: ${code}`);
    }
  }
  for (const filePath of [
    'projects/showcase/src/app/x.ts',
    'projects/showcase/src/app/x.spec.ts',
  ]) {
    for (const code of SHOWCASE_ONLY) {
      assert.deepEqual(await boundaryMessages(SHOWCASE_CONFIG, filePath, code), [], code);
    }
  }
});

/** The diagram's bench seam, by its alias and by the relative paths code would reach it by. */
const SEAM_ALIAS =
  "import { MAX_DOTS } from '@bench/diagram-seam';\nexport const cap = MAX_DOTS;\n";
const SEAM_RELATIVE = [
  "export * from './bench-seam';\n",
  "import { MAX_DOTS } from '../bench-seam';\nexport const cap = MAX_DOTS;\n",
  "import type { Rect } from '../../neat-ui/diagram/src/bench-seam.ts';\nexport type R = Rect;\n",
];

test('the diagram’s bench seam is importable under projects/bench/ only, by its alias', async () => {
  for (const [config, filePath] of [
    [KIT_CONFIG, 'projects/neat-ui/diagram/src/public-api.ts'],
    [KIT_CONFIG, 'projects/neat-ui/diagram/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/diagram/src/lib/x.spec.ts'],
    [KIT_CONFIG, 'projects/neat-ui/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/charts/src/lib/x.ts'],
    [SHOWCASE_CONFIG, 'projects/showcase/src/app/x.ts'],
  ]) {
    for (const code of [SEAM_ALIAS, ...SEAM_RELATIVE]) {
      const messages = await boundaryMessages(config, filePath, code);
      assert.equal(messages.length, 1, `${filePath}: ${code}`);
      assert.match(messages[0].message, /bench seam.*projects\/bench/, `${filePath}: ${code}`);
    }
  }
  for (const filePath of ['projects/bench/src/app/x.ts', 'projects/bench/src/app/x.spec.ts']) {
    assert.deepEqual(await boundaryMessages(BENCH_CONFIG, filePath, SEAM_ALIAS), [], filePath);
    for (const code of SEAM_RELATIVE) {
      const messages = await boundaryMessages(BENCH_CONFIG, filePath, code);
      assert.equal(messages.length, 1, `${filePath}: ${code}`);
      assert.match(messages[0].message, /@bench\/diagram-seam/, `${filePath}: ${code}`);
    }
  }
});

test('a module that only ends like the seam is not the seam', async () => {
  for (const specifier of ['./my-bench-seam', '@bench/diagram-seams', 'bench-seam-x']) {
    const messages = await boundaryMessages(
      KIT_CONFIG,
      'projects/neat-ui/diagram/src/lib/x.ts',
      importOf(specifier),
    );
    assert.deepEqual(messages, [], specifier);
  }
});

test('a package that only starts with a bench-only name is not bench-only', async () => {
  for (const specifier of ['source-map-js', 'ngx-vflowery', 'playwrights']) {
    const messages = await boundaryMessages(
      KIT_CONFIG,
      'projects/neat-ui/src/lib/x.ts',
      importOf(specifier),
    );
    assert.deepEqual(messages, [], specifier);
  }
});

/** Shiki as code would import it statically: its tokenizer, its engine, a grammar, its types. */
const SHIKI_VALUES = [
  "import { createShikiPrimitive } from '@shikijs/primitive';\nexport const make = createShikiPrimitive;\n",
  "import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';\nexport const e = createJavaScriptRegexEngine;\n",
  "import python from '@shikijs/langs/python';\nexport const grammar = python;\n",
  "export { codeToHtml } from 'shiki';\n",
  importOf('shiki/core'),
];
const SHIKI_TYPES = [
  "import type { ShikiPrimitive } from '@shikijs/primitive';\nexport type P = ShikiPrimitive;\n",
  "import type { ThemedToken } from '@shikijs/types';\nexport type T = ThemedToken;\n",
];
/** A grammar given as a dynamic import, as the code block's table and an app's provider do. */
const SHIKI_DYNAMIC = "export const rust = () => import('@shikijs/langs/rust');\n";

test('Shiki is imported statically by no one, and by the code-block entry for its types only', async () => {
  for (const [config, filePath] of [
    [KIT_CONFIG, 'projects/neat-ui/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/level-meter/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/charts/src/lib/x.ts'],
    [KIT_CONFIG, 'projects/neat-ui/diagram/src/lib/x.ts'],
    [SHOWCASE_CONFIG, 'projects/showcase/src/app/x.ts'],
    [BENCH_CONFIG, 'projects/bench/src/app/x.ts'],
  ]) {
    for (const code of [...SHIKI_VALUES, ...SHIKI_TYPES]) {
      const messages = await boundaryMessages(config, filePath, code);
      assert.equal(messages.length, 1, `${filePath}: ${code}`);
      assert.match(messages[0].message, /code-block alone/, `${filePath}: ${code}`);
    }
    assert.deepEqual(await boundaryMessages(config, filePath, SHIKI_DYNAMIC), [], filePath);
  }
  for (const filePath of [
    'projects/neat-ui/code-block/src/lib/x.ts',
    'projects/neat-ui/code-block/src/lib/x.spec.ts',
  ]) {
    for (const code of SHIKI_VALUES) {
      const messages = await boundaryMessages(KIT_CONFIG, filePath, code);
      assert.equal(messages.length, 1, `${filePath}: ${code}`);
      assert.match(messages[0].message, /import type/, `${filePath}: ${code}`);
    }
    for (const code of [...SHIKI_TYPES, SHIKI_DYNAMIC]) {
      assert.deepEqual(await boundaryMessages(KIT_CONFIG, filePath, code), [], code);
    }
  }
});

test('the code-block entry keeps the other boundaries beside its Shiki rule', async () => {
  const filePath = 'projects/neat-ui/code-block/src/lib/x.ts';
  const climbs = "import { x } from '../../../src/lib/theme/color';\nexport const y = x;\n";
  const messages = await boundaryMessages(KIT_CONFIG, filePath, climbs);
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /package name/);
  await expectD3Rule(KIT_CONFIG, filePath, [...CHARTS_D3, ...DIAGRAM_D3, ...OTHER_D3], true);
  for (const code of BENCH_ONLY) {
    assert.equal((await boundaryMessages(KIT_CONFIG, filePath, code)).length, 1, code);
  }
});

test('a package that only starts with shiki is not Shiki', async () => {
  for (const specifier of ['shikiji', 'shiki-magic-move', '@shikijsx/core']) {
    const messages = await boundaryMessages(
      KIT_CONFIG,
      'projects/neat-ui/src/lib/x.ts',
      importOf(specifier),
    );
    assert.deepEqual(messages, [], specifier);
  }
});

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import { DEV_ONLY, findProblems, SEAM_NAMES, SECONDARY_ENTRIES, seamNames } from './check-dist.mjs';

const PRIMARY = 'fesm2022/sima-neat-ui.mjs';
const SEGMENTED = 'fesm2022/sima-neat-ui-segmented.mjs';
const STYLESHEET = 'styles/neat-ui.tailwind.css';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Writes a dist tree to a temp dir; `files` maps a path under it to its content. */
function distWith(files) {
  const root = mkdtempSync(join(tmpdir(), 'check-dist-'));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/** A secondary entry's FESM, which carries the selectors the primary must not. */
const entryFesm = (name) => `fesm2022/sima-neat-ui-${name}.mjs`;

const SHIPPABLE = {
  [PRIMARY]: 'export class NeatButton {}\n',
  ...Object.fromEntries(
    Object.entries(SECONDARY_ENTRIES).map(([name, selectors]) => [
      entryFesm(name),
      selectors.map((selector) => `selector: "${selector}"\n`).join(''),
    ]),
  ),
  [STYLESHEET]: '.flex{display:flex}\n',
};

/** The folders beside the primary's `src` that hold an ng-package.json: the kit's secondary entries. */
const LIBRARY = fileURLToPath(new URL('../projects/neat-ui', import.meta.url));
const entryFolders = readdirSync(LIBRARY, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && existsSync(join(LIBRARY, entry.name, 'ng-package.json')),
  )
  .map((entry) => entry.name);

test('check-dist lists every kit entry point that is not the primary', () => {
  assert.deepEqual(Object.keys(SECONDARY_ENTRIES).sort(), entryFolders.sort());
});

test('check-dist fails when a listed secondary entry FESM is missing', () => {
  for (const name of Object.keys(SECONDARY_ENTRIES)) {
    const { [entryFesm(name)]: _entry, ...withoutEntry } = SHIPPABLE;
    const problems = findProblems(distWith(withoutEntry));
    assert.equal(problems.length, 1, name);
    assert.match(problems[0], new RegExp(`sima-neat-ui-${name}\\.mjs is missing`), name);
    assert.match(problems[0], new RegExp(`@sima/neat-ui/${name} entry point`), name);
  }
});

test('check-dist fails when the primary FESM contains a moved selector such as "neat-segmented"', () => {
  const problems = findProblems(
    distWith({ ...SHIPPABLE, [PRIMARY]: 'selector: "neat-segmented"\n' }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /sima-neat-ui\.mjs contains "neat-segmented"/);
  assert.match(problems[0], /@sima\/neat-ui\/segmented/);
});

test('check-dist fails when the primary FESM contains any selector of an entry, not only its first', () => {
  const problems = findProblems(distWith({ ...SHIPPABLE, [PRIMARY]: 'selector: "neat-tab"\n' }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /contains "neat-tab"; that code belongs in @sima\/neat-ui\/tabs/);
});

test('check-dist fails when the primary FESM contains the string "neat-video-tile"', () => {
  const problems = findProblems(
    distWith({ ...SHIPPABLE, [PRIMARY]: 'selector: "neat-video-tile"\n' }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /sima-neat-ui\.mjs contains "neat-video-tile"/);
});

test('check-dist fails when the primary FESM is missing', () => {
  const { [PRIMARY]: _primary, ...withoutPrimary } = SHIPPABLE;
  const problems = findProblems(distWith(withoutPrimary));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /sima-neat-ui\.mjs is missing/);
});

test('check-dist fails when the compiled stylesheet is missing', () => {
  const { [STYLESHEET]: _css, ...withoutCss } = SHIPPABLE;
  const problems = findProblems(distWith(withoutCss));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /neat-ui\.tailwind\.css is missing/);
});

test('check-dist fails when any file references the helm alias', () => {
  const problems = findProblems(
    distWith({ ...SHIPPABLE, [SEGMENTED]: 'import "@neat-ui/helm/button";\n' }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /sima-neat-ui-segmented\.mjs references @neat-ui\/helm/);
});

test('check-dist fails when any file imports a dev-only package', () => {
  assert.deepEqual(DEV_ONLY, [
    'ngx-vflow',
    'd3-drag',
    'playwright',
    'playwright-core',
    'source-map',
    'sharp',
    'lucide-static',
  ]);
  const imports = [
    (name) => `import { x } from '${name}';\n`,
    (name) => `export * from "${name}/sub/path.js";\n`,
    (name) => `const x = await import('${name}');\n`,
    (name) => `{ "dependencies": { "${name}": "^1.0.0" } }\n`,
  ];
  for (const name of DEV_ONLY) {
    for (const source of imports) {
      const problems = findProblems(distWith({ ...SHIPPABLE, [SEGMENTED]: source(name) }));
      assert.equal(problems.length, 1, source(name));
      assert.match(problems[0], new RegExp(`sima-neat-ui-segmented\\.mjs references ${name},`));
      assert.match(problems[0], /a dev dependency no app installs/);
    }
  }
});

test('check-dist leaves alone names that only start with a dev-only one', () => {
  const source = [
    "import { x } from 'source-map-js';",
    "import { y } from 'd3-dragging';",
    "import { z } from 'lucide';",
    '//# sourceMappingURL=sima-neat-ui.mjs.map',
    '// a source-map comment, not an import',
  ].join('\n');
  assert.deepEqual(findProblems(distWith({ ...SHIPPABLE, [SEGMENTED]: source })), []);
});

const DIAGRAM = 'fesm2022/sima-neat-ui-diagram.mjs';
const DIAGRAM_TYPES = 'types/sima-neat-ui-diagram.d.ts';

test('check-dist reads the names the diagram’s bench seam exports from the seam itself', () => {
  const source = [
    "export { drawLevel, type DrawnEdge } from './lib/drawing';",
    "export type { Rect } from './lib/layout';",
    'export {',
    '  DIAGRAM_MESSAGES_CONTEXT,',
    '  type DotFrameProbe,',
    "} from './lib/messages/context';",
    "export { MAX_DOTS as CAP } from './lib/messages/dot-model';",
  ].join('\n');
  assert.deepEqual(seamNames(source), [
    'drawLevel',
    'DrawnEdge',
    'Rect',
    'DIAGRAM_MESSAGES_CONTEXT',
    'DotFrameProbe',
    'CAP',
  ]);
  for (const name of ['drawLevel', 'DIAGRAM_MESSAGES_CONTEXT', 'DOT_FRAME_PROBE', 'MAX_DOTS']) {
    assert.ok(SEAM_NAMES.includes(name), name);
  }
});

test('check-dist fails when the package exports a name of the bench seam', () => {
  const exporting = [
    [DIAGRAM, 'const MAX_DOTS = 16384;\nexport { NeatDiagramView, MAX_DOTS };\n', 'MAX_DOTS'],
    [DIAGRAM, 'export { drawLevel as draw };\n', 'drawLevel'],
    [DIAGRAM_TYPES, 'export declare const DOT_FRAME_PROBE: unknown;\n', 'DOT_FRAME_PROBE'],
    [DIAGRAM_TYPES, 'export type { NeatDiagram, DiagramTransform };\n', 'DiagramTransform'],
    [DIAGRAM_TYPES, 'export declare function placeNotes(): void;\n', 'placeNotes'],
  ];
  for (const [file, source, name] of exporting) {
    const problems = findProblems(distWith({ ...SHIPPABLE, [file]: source }));
    assert.equal(problems.length, 1, source);
    assert.match(problems[0], new RegExp(`exports ${name}, .*bench seam`), source);
  }
});

test('check-dist leaves another entry alone that exports a name the seam also has', () => {
  // The video entry may well export its own `Rect` one day: not the diagram's seam.
  const video = 'fesm2022/sima-neat-ui-video.mjs';
  const videoTypes = 'types/sima-neat-ui-video.d.ts';
  assert.ok(SEAM_NAMES.includes('Rect'));
  const exports = {
    [video]: 'class Rect {}\nexport { Rect, DrawnEdge };\n',
    [videoTypes]: 'export interface Rect { x: number }\nexport declare const MAX_DOTS = 1;\n',
  };
  assert.deepEqual(findProblems(distWith({ ...SHIPPABLE, ...exports })), []);
  // The same names are refused in the diagram's files.
  const problems = findProblems(
    distWith({ ...SHIPPABLE, [DIAGRAM_TYPES]: 'export interface Rect { x: number }\n' }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /exports Rect, .*bench seam/);
});

test('check-dist fails when the package names the bench seam’s file', () => {
  const map = '{"sources":["../../projects/neat-ui/diagram/src/bench-seam.ts"]}';
  const problems = findProblems(distWith({ ...SHIPPABLE, [`${DIAGRAM}.map`]: map }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /sima-neat-ui-diagram\.mjs\.map names bench-seam/);
  // Package-wide: another entry's map is no exception.
  const other = findProblems(
    distWith({ ...SHIPPABLE, 'fesm2022/sima-neat-ui-video.mjs.map': map }),
  );
  assert.equal(other.length, 1);
  assert.match(other[0], /sima-neat-ui-video\.mjs\.map names bench-seam/);
});

test('check-dist leaves alone the seam’s names where the package uses them without exporting', () => {
  const fesm = [
    'const MAX_DOTS = 16384;',
    "const DOT_FRAME_PROBE = new InjectionToken('DOT_FRAME_PROBE');",
    'function drawLevel() {}',
    'export { NeatDiagramView };',
  ].join('\n');
  const types = 'declare const DIAGRAM_MESSAGES_CONTEXT: unknown;\nexport { NeatDiagramView };\n';
  assert.deepEqual(
    findProblems(distWith({ ...SHIPPABLE, [DIAGRAM]: fesm, [DIAGRAM_TYPES]: types })),
    [],
  );
});

test('check-dist fails when the dist directory does not exist', () => {
  const problems = findProblems(join(tmpdir(), 'check-dist-no-such-dir'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /does not exist/);
});

test('check-dist passes for a tree with every entry point FESM, the stylesheet, and no @neat-ui/helm reference', () => {
  assert.deepEqual(findProblems(distWith(SHIPPABLE)), []);
});

const CODE_BLOCK = entryFesm('code-block');

test('check-dist leaves the code block’s dynamic imports of Shiki and its grammars alone', () => {
  const lazy = [
    'const shiki = () => Promise.all([import("@shikijs/primitive"), import("@shikijs/engine-javascript")]);',
    "const python = () => import('@shikijs/langs/python');",
  ].join('\n');
  const types =
    "/** rust: () => import('@shikijs/langs/rust') */\nexport type NeatCodeLanguages = object;\n";
  assert.deepEqual(
    findProblems(
      distWith({
        ...SHIPPABLE,
        [CODE_BLOCK]: lazy,
        'types/sima-neat-ui-code-block.d.ts': types,
        'package.json': '{ "dependencies": { "@shikijs/langs": "4.6.0" } }',
      }),
    ),
    [],
  );
});

test('check-dist fails a static import or export of Shiki, in the code block too', () => {
  for (const statement of [
    'import { createShikiPrimitive } from "@shikijs/primitive";',
    'import python from "@shikijs/langs/python";',
    'import "@shikijs/engine-javascript";',
    'export * from "shiki/core";',
  ]) {
    const problems = findProblems(distWith({ ...SHIPPABLE, [CODE_BLOCK]: statement }));
    assert.equal(problems.length, 1, statement);
    assert.match(problems[0], /statically/, statement);
  }
  const typed = "import { ThemedToken } from '@shikijs/primitive';\n";
  const problems = findProblems(
    distWith({ ...SHIPPABLE, 'types/sima-neat-ui-code-block.d.ts': typed }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /statically/);
});

test('check-dist fails another entry that names Shiki, even lazily', () => {
  const lazy = "const python = () => import('@shikijs/langs/python');";
  const problems = findProblems(distWith({ ...SHIPPABLE, [SEGMENTED]: lazy }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /only @sima\/neat-ui\/code-block/);
});

test('check-dist fails a module that holds a TextMate grammar', () => {
  const grammar = 'const lang = { name: "python", scopeName: "source.python", patterns: [] };';
  const problems = findProblems(distWith({ ...SHIPPABLE, [CODE_BLOCK]: grammar }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /TextMate grammar/);
});

test('check-dist leaves alone names that only start with shiki', () => {
  const code = 'import { x } from "shikiji-like";\nimport { y } from "@shikijsx/core";';
  assert.deepEqual(findProblems(distWith({ ...SHIPPABLE, [SEGMENTED]: code })), []);
});

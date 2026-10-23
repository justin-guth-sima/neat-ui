import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import { findProblems, SECONDARY_ENTRIES } from './check-dist.mjs';

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

test('check-dist fails when the dist directory does not exist', () => {
  const problems = findProblems(join(tmpdir(), 'check-dist-no-such-dir'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /does not exist/);
});

test('check-dist passes for a tree with every entry point FESM, the stylesheet, and no @neat-ui/helm reference', () => {
  assert.deepEqual(findProblems(distWith(SHIPPABLE)), []);
});

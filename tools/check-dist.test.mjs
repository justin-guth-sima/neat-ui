import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { findProblems } from './check-dist.mjs';

const PRIMARY = 'fesm2022/sima-neat-ui.mjs';
const VIDEO = 'fesm2022/sima-neat-ui-video.mjs';
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

const SHIPPABLE = {
  [PRIMARY]: 'export class NeatButton {}\n',
  [VIDEO]: 'export class NeatVideoTile { selector = "neat-video-tile"; }\n',
  [STYLESHEET]: '.flex{display:flex}\n',
};

test('check-dist fails when dist/neat-ui/fesm2022/sima-neat-ui-video.mjs is missing', () => {
  const { [VIDEO]: _video, ...withoutVideo } = SHIPPABLE;
  const problems = findProblems(distWith(withoutVideo));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /sima-neat-ui-video\.mjs is missing/);
});

test('check-dist fails when the primary FESM contains the string "neat-video-tile"', () => {
  const problems = findProblems(
    distWith({ ...SHIPPABLE, [PRIMARY]: 'selector: "neat-video-tile"\n' }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /sima-neat-ui\.mjs contains the video tile/);
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
    distWith({ ...SHIPPABLE, [VIDEO]: 'import "@neat-ui/helm/button";\n' }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /sima-neat-ui-video\.mjs references @neat-ui\/helm/);
});

test('check-dist fails when the dist directory does not exist', () => {
  const problems = findProblems(join(tmpdir(), 'check-dist-no-such-dir'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /does not exist/);
});

test('check-dist passes for a tree with both FESMs, the stylesheet, and no @neat-ui/helm reference', () => {
  assert.deepEqual(findProblems(distWith(SHIPPABLE)), []);
});

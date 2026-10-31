import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SourceMapGenerator } from 'source-map';
import { createMapper, lineColumnOf, mapSteps, parseScriptKey } from './sourcemaps.mjs';

// The key the page builds for a script (`loafResult`): "<function> <url>:<char position>", or the
// invoker where it has neither.
const KEY = 'tick http://127.0.0.1:5000/kit-host-ABC.js:31';

test('reads the function, URL and character position out of a script key', () => {
  assert.deepEqual(parseScriptKey(KEY), {
    fn: 'tick',
    url: 'http://127.0.0.1:5000/kit-host-ABC.js',
    pos: 31,
  });
  assert.deepEqual(parseScriptKey('http://x/main.js:7'), {
    fn: '',
    url: 'http://x/main.js',
    pos: 7,
  });
  assert.deepEqual(parseScriptKey('a.b.c http://x/main.js:0'), {
    fn: 'a.b.c',
    url: 'http://x/main.js',
    pos: 0,
  });
});

test('leaves a key that names no script alone: an invoker, or a function with no address', () => {
  assert.equal(parseScriptKey('FrameRequestCallback'), null);
  assert.equal(parseScriptKey('BUTTON#go.onclick'), null);
  assert.equal(parseScriptKey('tick :-1'), null);
});

test('turns a character position into the line and column a source map is read by', () => {
  const text = 'ab\ncdef\n\ngh';
  assert.deepEqual(lineColumnOf(text, 0), { line: 1, column: 0 });
  assert.deepEqual(lineColumnOf(text, 4), { line: 2, column: 1 });
  assert.deepEqual(lineColumnOf(text, 9), { line: 4, column: 0 });
  assert.deepEqual(lineColumnOf(text, 11), { line: 4, column: 2 });
});

/** A bundle of two lines whose second line came from a source file, as a build would map it. */
const BUNDLE = 'function a(){}\nfunction b(){tick()}\n';
function mapOf() {
  const generator = new SourceMapGenerator({ file: 'kit-host-ABC.js' });
  generator.addMapping({
    generated: { line: 2, column: 13 },
    original: { line: 42, column: 6 },
    source: '../../../../projects/bench/src/app/hosts/kit-host.ts',
    name: 'tick',
  });
  return generator.toJSON();
}

const files = {
  '/dist/kit-host-ABC.js': BUNDLE,
  '/dist/kit-host-ABC.js.map': JSON.stringify(mapOf()),
};
const readFile = async (path) => {
  if (!(path in files)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  return files[path];
};

test('maps a script’s position back to the source file and line the build came from', async () => {
  const mapper = await createMapper({ distDir: '/dist', readFile });
  const pos = BUNDLE.indexOf('tick');
  const mapped = await mapper.map(`b http://127.0.0.1:5000/kit-host-ABC.js:${pos}`);
  assert.equal(mapped.key, 'tick projects/bench/src/app/hosts/kit-host.ts:42:6');
  assert.equal(mapped.mapped, true);
  mapper.close();
});

test('keeps the key where the chunk has no map, or the position maps to nothing, and says so', async () => {
  const mapper = await createMapper({ distDir: '/dist', readFile });
  const other = await mapper.map('x http://h/other-chunk.js:10');
  assert.deepEqual(other, { key: 'x http://h/other-chunk.js:10', mapped: false });
  const nowhere = await mapper.map('x http://h/kit-host-ABC.js:0');
  assert.equal(nowhere.mapped, false);
  const invoker = await mapper.map('FrameRequestCallback');
  assert.deepEqual(invoker, { key: 'FrameRequestCallback', mapped: false });
  mapper.close();
});

test('does not read a file outside the build folder, whatever the URL says', async () => {
  const asked = [];
  const mapper = await createMapper({
    distDir: '/dist',
    readFile: async (path) => {
      asked.push(path);
      throw new Error('ENOENT');
    },
  });
  await mapper.map('x http://h/../../etc/passwd:3');
  await mapper.map('x http://h/%2e%2e/secret.js:3');
  assert.deepEqual(
    asked.filter((path) => !path.startsWith('/dist/')),
    [],
  );
  mapper.close();
});

test('maps every phase’s top scripts in a step list, keeping the raw key beside the mapped one', async () => {
  const mapper = await createMapper({ distDir: '/dist', readFile });
  const raw = `b http://127.0.0.1:5000/kit-host-ABC.js:${BUNDLE.indexOf('tick')}`;
  const steps = [
    {
      step: 0,
      phases: {
        pan: {
          loaf: {
            topScripts: [
              { key: raw, ms: 80 },
              { key: 'FrameRequestCallback', ms: 60 },
            ],
          },
        },
        idle: { fps: 60 },
      },
    },
  ];
  const [out] = await mapSteps(steps, mapper);
  assert.deepEqual(out.phases.pan.loaf.topScripts, [
    { key: 'tick projects/bench/src/app/hosts/kit-host.ts:42:6', raw, ms: 80 },
    { key: 'FrameRequestCallback', ms: 60 },
  ]);
  assert.deepEqual(out.phases.idle, { fps: 60 });
  mapper.close();
});

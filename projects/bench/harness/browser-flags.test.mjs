import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBrowserFlags } from './browser-flags.mjs';

test('reads a space-separated list of --name and --name=value tokens', () => {
  assert.deepEqual(parseBrowserFlags('--disable-gpu'), ['--disable-gpu']);
  assert.deepEqual(parseBrowserFlags('  --num-raster-threads=4   --disable-gpu '), [
    '--num-raster-threads=4',
    '--disable-gpu',
  ]);
  assert.deepEqual(parseBrowserFlags('--disable-features=A,B:c --use-angle=gl'), [
    '--disable-features=A,B:c',
    '--use-angle=gl',
  ]);
  assert.deepEqual(parseBrowserFlags('--js-flags=--max-old-space-size=512'), [
    '--js-flags=--max-old-space-size=512',
  ]);
});

test('is an empty list for nothing, so a campaign without the option has none', () => {
  assert.deepEqual(parseBrowserFlags(undefined), []);
});

test('refuses a token that is not a flag, saying which', () => {
  assert.throws(() => parseBrowserFlags(''), /--browser-flags.*empty/);
  assert.throws(() => parseBrowserFlags('   '), /--browser-flags.*empty/);
  assert.throws(() => parseBrowserFlags('disable-gpu'), /disable-gpu/);
  assert.throws(() => parseBrowserFlags('-x'), /-x/);
  assert.throws(() => parseBrowserFlags('--disable-gpu stray'), /stray/);
  assert.throws(() => parseBrowserFlags('--='), /--=/);
});

test('refuses shell metacharacters, which the board’s shell would run', () => {
  for (const bad of [
    '--a=b;id',
    '--a=$(id)',
    '--a=`id`',
    '--a=b|c',
    '--a=b&c',
    '--a=b>c',
    '--a=b<c',
    "--a='b'",
    '--a="b"',
    '--a=b\\c',
    '--a=*',
    '--a=b?c',
    '--a=(b)',
    '--a=b#c',
    '--a=~',
    '--a=!b',
    '--a;id',
    '--a\nid',
  ]) {
    assert.throws(() => parseBrowserFlags(bad), /--browser-flags/, JSON.stringify(bad));
  }
});

test('refuses the flags the harness owns, which would break the run or its cleanup', () => {
  for (const owned of [
    '--remote-debugging-port=9222',
    '--remote-debugging-address=0.0.0.0',
    '--remote-debugging-pipe',
    '--user-data-dir=/tmp/x',
    '--headless',
    '--headless=new',
    '--kiosk',
    '--window-size=100,100',
    '--window-position=1,1',
  ]) {
    assert.throws(() => parseBrowserFlags(owned), /harness/, owned);
  }
});

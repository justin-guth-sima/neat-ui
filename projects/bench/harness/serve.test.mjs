import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { resolveRequest, serveDist } from './serve.mjs';

let root;
let dist;
let server;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'bench-serve-'));
  dist = join(root, 'dist');
  mkdirSync(dist);
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>bench</title>');
  writeFileSync(join(dist, 'chunk-A.js'), 'export const a = 1;');
  writeFileSync(join(dist, 'chunk-A.js.map'), '{"version":3}');
  writeFileSync(join(dist, 'styles.css'), 'body{}');
  writeFileSync(join(dist, 'shelf.webp'), 'RIFF');
  writeFileSync(join(root, 'secret.txt'), 'not for the browser');
  server = await serveDist(dist);
});

after(async () => {
  await server.close();
  rmSync(root, { recursive: true, force: true });
});

test('resolves the root to the index and a path to its file under the folder', () => {
  assert.equal(resolveRequest('/d', '/'), '/d/index.html');
  assert.equal(resolveRequest('/d', '/chunk-A.js'), '/d/chunk-A.js');
  assert.equal(resolveRequest('/d', '/a/b.js?x=1#y'), '/d/a/b.js');
});

test('refuses a path that leaves the folder, however it is written', () => {
  for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/a/../../x', '/%2e%2e%2fx', '/\0']) {
    assert.equal(resolveRequest('/d', path), null, path);
  }
});

test('serves the built files with the types a browser needs to run them', async () => {
  const get = async (path) => fetch(`${server.url}${path}`);
  const index = await get('');
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  const js = await get('chunk-A.js');
  assert.match(js.headers.get('content-type'), /text\/javascript/);
  assert.equal(await js.text(), 'export const a = 1;');
  assert.match((await get('styles.css')).headers.get('content-type'), /text\/css/);
  assert.match((await get('chunk-A.js.map')).headers.get('content-type'), /application\/json/);
  // The chat page's picture.
  assert.equal((await get('shelf.webp')).headers.get('content-type'), 'image/webp');
});

test('answers 404 for a file that is not there and for one outside the folder', async () => {
  assert.equal((await fetch(`${server.url}missing.js`)).status, 404);
  const outside = await fetch(`${server.url}..%2fsecret.txt`);
  assert.equal(outside.status, 404);
  assert.doesNotMatch(await outside.text(), /not for the browser/);
});

test('listens on this machine only, on a port the system chose', () => {
  assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.ok(![4200, 9900, 4300].includes(server.port));
});

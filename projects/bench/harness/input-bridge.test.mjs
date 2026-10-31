import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInputBridge } from './input-bridge.mjs';

/** A mouse that logs, and whose actions take as long as `delay` says. */
function fakeMouse(delay = () => Promise.resolve()) {
  const log = [];
  const act = (text) => async () => {
    log.push(text);
    await delay();
  };
  return {
    log,
    move: (x, y) => act(`move ${x} ${y}`)(),
    down: () => act('down')(),
    up: () => act('up')(),
    wheel: (dx, dy) => act(`wheel ${dx} ${dy}`)(),
  };
}

test('plays a press, drags and a release as the browser’s own pointer actions, in order', async () => {
  const mouse = fakeMouse();
  const bridge = createInputBridge(mouse);
  bridge.push({ kind: 'press', x: 10, y: 20 });
  await bridge.settle();
  bridge.push({ kind: 'drag', x: 30, y: 40 });
  await bridge.settle();
  bridge.push({ kind: 'release', x: 30, y: 40 });
  await bridge.settle();
  assert.deepEqual(mouse.log, ['move 10 20', 'down', 'move 30 40', 'move 30 40', 'up']);
});

test('moves to the wheel’s position first, then turns it by the page’s delta', async () => {
  const mouse = fakeMouse();
  const bridge = createInputBridge(mouse);
  bridge.push({ kind: 'wheel', x: 5, y: 6, deltaY: -120 });
  await bridge.settle();
  assert.deepEqual(mouse.log, ['move 5 6', 'wheel 0 -120']);
});

test('keeps only the newest of the drags that waited while the browser was busy', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const mouse = fakeMouse(() => gate);
  const bridge = createInputBridge(mouse);
  bridge.push({ kind: 'drag', x: 1, y: 1 });
  // The first is in flight; these wait, and each replaces the one before.
  bridge.push({ kind: 'drag', x: 2, y: 2 });
  bridge.push({ kind: 'drag', x: 3, y: 3 });
  bridge.push({ kind: 'drag', x: 4, y: 4 });
  release();
  await bridge.settle();
  assert.deepEqual(mouse.log, ['move 1 1', 'move 4 4']);
  assert.equal(bridge.coalesced, 2);
});

test('adds up the wheel turns that waited, so the zoom reaches the same place', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const mouse = fakeMouse(() => gate);
  const bridge = createInputBridge(mouse);
  bridge.push({ kind: 'wheel', x: 9, y: 9, deltaY: -10 });
  bridge.push({ kind: 'wheel', x: 9, y: 9, deltaY: -20 });
  bridge.push({ kind: 'wheel', x: 9, y: 9, deltaY: -30 });
  release();
  await bridge.settle();
  assert.deepEqual(mouse.log, ['move 9 9', 'wheel 0 -10', 'move 9 9', 'wheel 0 -50']);
});

test('never drops or merges a press or a release, or lets a drag pass the release before it', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const mouse = fakeMouse(() => gate);
  const bridge = createInputBridge(mouse);
  bridge.push({ kind: 'press', x: 1, y: 1 });
  bridge.push({ kind: 'drag', x: 2, y: 2 });
  bridge.push({ kind: 'release', x: 3, y: 3 });
  bridge.push({ kind: 'drag', x: 4, y: 4 });
  release();
  await bridge.settle();
  assert.deepEqual(
    mouse.log.filter((line) => line === 'down' || line === 'up'),
    ['down', 'up'],
  );
  assert.ok(mouse.log.indexOf('up') < mouse.log.lastIndexOf('move 4 4'));
  assert.ok(mouse.log.indexOf('move 2 2') < mouse.log.indexOf('up'));
});

test('records what the browser refused and goes on: a page that closed ends the replay, not the run', async () => {
  const mouse = fakeMouse();
  mouse.move = async () => {
    throw new Error('Target closed');
  };
  const bridge = createInputBridge(mouse);
  bridge.push({ kind: 'drag', x: 1, y: 1 });
  bridge.push({ kind: 'drag', x: 2, y: 2 });
  await bridge.settle();
  assert.equal(bridge.errors.length >= 1, true);
  assert.match(bridge.errors[0], /Target closed/);
});

test('says how many actions it played', async () => {
  const mouse = fakeMouse();
  const bridge = createInputBridge(mouse);
  bridge.push({ kind: 'press', x: 1, y: 1 });
  await bridge.settle();
  bridge.push({ kind: 'drag', x: 2, y: 2 });
  await bridge.settle();
  assert.equal(bridge.played, 2);
});

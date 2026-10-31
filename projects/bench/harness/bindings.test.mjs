import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindingHandler } from './bindings.mjs';

test('gives the run on screen the events of its own page', () => {
  const page = {};
  const heard = [];
  const listener = { current: { page, onEvent: (e) => heard.push(e), onInput: null } };
  bindingHandler(listener, 'onEvent')({ page }, { type: 'run-begin' });
  assert.deepEqual(heard, [{ type: 'run-begin' }]);
});

test('drops the events of any other page of the context: a closing or stale page', () => {
  const heard = [];
  const listener = { current: { page: {}, onEvent: (e) => heard.push(e) } };
  bindingHandler(listener, 'onEvent')({ page: {} }, { type: 'step-end' });
  bindingHandler(listener, 'onEvent')({ page: null }, { type: 'step-end' });
  bindingHandler(listener, 'onEvent')({}, { type: 'step-end' });
  assert.deepEqual(heard, []);
});

test('hears nothing between runs, and is not stopped by a listener with no input hook', () => {
  const page = {};
  const listener = { current: null };
  assert.doesNotThrow(() => bindingHandler(listener, 'onEvent')({ page }, {}));
  listener.current = { page, onEvent: () => undefined, onInput: null };
  assert.doesNotThrow(() => bindingHandler(listener, 'onInput')({ page }, {}));
});

test('routes input to the input hook of the same page only', () => {
  const page = {};
  const got = [];
  const listener = { current: { page, onEvent: () => undefined, onInput: (e) => got.push(e) } };
  bindingHandler(listener, 'onInput')({ page }, { kind: 'press' });
  bindingHandler(listener, 'onInput')({ page: {} }, { kind: 'release' });
  assert.deepEqual(got, [{ kind: 'press' }]);
});

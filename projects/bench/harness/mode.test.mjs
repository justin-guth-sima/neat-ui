import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isHeadless, pageSize, modeWarnings } from './mode.mjs';

const HEADED = 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36';
const HEADLESS = HEADED.replace('Chrome/', 'HeadlessChrome/');

test('tells a headless browser from its user agent, whoever launched it', () => {
  assert.equal(isHeadless({ userAgent: HEADLESS, launchArgs: [] }), true);
  assert.equal(isHeadless({ userAgent: HEADED, launchArgs: [] }), false);
});

test('tells a headless browser from its command line where the user agent was changed', () => {
  assert.equal(isHeadless({ userAgent: HEADED, launchArgs: ['chrome', '--headless=new'] }), true);
  assert.equal(isHeadless({ userAgent: HEADED, launchArgs: ['chrome', '--headless'] }), true);
  assert.equal(isHeadless({ userAgent: HEADED, launchArgs: ['chrome', '--headless-foo'] }), false);
  assert.equal(isHeadless({ userAgent: undefined, launchArgs: [] }), false);
});

test('gives a headed browser on another machine its own window size, no emulation', () => {
  const size = { w: 1920, h: 1080 };
  assert.equal(pageSize({ viewport: size, headless: false, local: false }), null);
  assert.deepEqual(pageSize({ viewport: size, headless: true, local: false }), {
    width: 1920,
    height: 1080,
  });
});

test('keeps the laptop profile’s size on a browser started here, and native means native', () => {
  const size = { w: 1920, h: 1080 };
  assert.deepEqual(pageSize({ viewport: size, headless: false, local: true }), {
    width: 1920,
    height: 1080,
  });
  assert.equal(pageSize({ viewport: 'native', headless: true, local: true }), null);
  assert.equal(pageSize({ viewport: 'native', headless: true, local: false }), null);
});

const size = { w: 1920, h: 1080 };

test('warns of a headless browser, and says why a remote one without a display is', () => {
  const [plain] = modeWarnings({
    headless: true,
    target: { kind: 'local' },
    options: { remote: {}, viewport: size },
  });
  assert.match(plain, /Headless run/);
  const remote = modeWarnings({
    headless: true,
    target: { kind: 'remote' },
    options: { headless: false, remote: {}, viewport: size },
  });
  assert.equal(remote.length, 1);
  assert.match(remote[0], /Headless run/);
  assert.match(remote[0], /--remote-display/);
});

test('says nothing of a headed browser, but that a size asked for does not apply on a board', () => {
  assert.deepEqual(
    modeWarnings({
      headless: false,
      target: { kind: 'local' },
      options: { remote: {}, viewport: size },
    }),
    [],
  );
  const [ignored] = modeWarnings({
    headless: false,
    target: { kind: 'remote' },
    options: { remote: { display: ':0' }, viewport: size },
  });
  assert.match(ignored, /--viewport 1920x1080 is ignored/);
  assert.deepEqual(
    modeWarnings({
      headless: false,
      target: { kind: 'remote' },
      options: { remote: { display: ':0' }, viewport: 'native' },
    }),
    [],
  );
});

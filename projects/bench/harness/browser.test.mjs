import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { chromium } from 'playwright';
import { openBrowser } from './browser.mjs';

// A browser over CDP, as Playwright hands it out, with only what `openBrowser` and a session use.
// `contexts` is what the browser already has; a context made by `newContext` joins it, as it does
// in Playwright.
function fakeBrowser(contexts) {
  const made = [];
  const context = () => ({
    closed: false,
    exposeBinding: async () => undefined,
    newPage: async () => ({ close: async () => undefined, setViewportSize: async () => undefined }),
    close: async function () {
      this.closed = true;
    },
  });
  const browser = {
    contexts: () => contexts,
    newContext: async () => {
      const created = context();
      made.push(created);
      contexts.push(created);
      return created;
    },
    newBrowserCDPSession: async () => ({
      send: async (method) =>
        method === 'SystemInfo.getInfo'
          ? { commandLine: '', gpu: {} }
          : { userAgent: 'Chrome/156.0.0.0' },
    }),
    version: () => '156.0.0.0',
    close: async () => undefined,
  };
  return { browser, made, context };
}

const original = chromium.connectOverCDP;
const originalLaunch = chromium.launch;
afterEach(() => {
  chromium.connectOverCDP = original;
  chromium.launch = originalLaunch;
});

test('launches the channel asked for, else Chromium headless and the bundled browser headed', async () => {
  const channels = [];
  chromium.launch = async (options) => {
    channels.push(options.channel);
    return fakeBrowser([]).browser;
  };
  const launch = (options) =>
    openBrowser({ target: { kind: 'local' }, viewport: { w: 1920, h: 1080 }, dpr: 1, ...options });
  await launch({ headless: false, channel: 'chrome' });
  await launch({ headless: true });
  await launch({ headless: false });
  assert.deepEqual(channels, ['chrome', 'chromium', undefined]);
});

const open = (browser) => {
  chromium.connectOverCDP = async () => browser;
  return openBrowser({
    target: { kind: 'cdp', endpoint: 'http://127.0.0.1:1' },
    headless: false,
    viewport: { w: 1920, h: 1080 },
    dpr: 1,
  });
};

test('closes the context it had to make on a browser with none, once the run is released', async () => {
  const { browser, made } = fakeBrowser([]);
  const session = await (await open(browser)).session();
  assert.equal(made.length, 1);
  await session.release();
  assert.equal(made[0].closed, true);
});

test('leaves the browser’s own context open: it was not made here', async () => {
  const f = fakeBrowser([]);
  const own = f.context();
  const session = await (await open(fakeBrowser([own]).browser)).session();
  assert.equal(session.context, own);
  await session.release();
  assert.equal(own.closed, false);
});

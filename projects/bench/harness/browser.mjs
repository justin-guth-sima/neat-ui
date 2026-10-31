// The browser a campaign drives (design 4.1): Playwright's Chromium launched here, or one already
// listening for CDP (through the user's own tunnel, or the one `remote.mjs` starts on the board).
// Each run gets a page of its own, so no heap carries over; the browser's own facts (GPU feature
// status from `SystemInfo.getInfo`, its command line) are read once.
import { chromium } from 'playwright';
import { withTimeout } from './watchdog.mjs';

const LAUNCH_ARGS = ['--enable-precise-memory-info'];

/** The device pixel ratio the machine's own screen gives a window, as a headed browser reports. */
async function nativeDpr(browser) {
  const context = await browser.newContext({ viewport: null });
  try {
    const page = await context.newPage();
    return await page.evaluate(() => window.devicePixelRatio);
  } finally {
    await context.close();
  }
}

/**
 * Opens the browser for `target` ({ kind: 'local' } or { kind: 'cdp', endpoint }). Resolves with
 * `session(options)`, which gives a run its context and page (and `release` to give them back),
 * `facts()` for the result's machine and `close()`.
 */
export async function openBrowser({ target, headless, viewport, dpr }) {
  const local = target.kind === 'local';
  const browser = local
    ? await chromium.launch({
        // Playwright's old headless shell paces frames differently from the browser a person
        // uses; its `chromium` channel is the new headless, the nearest to a headed run.
        headless,
        channel: headless ? 'chromium' : undefined,
        args: LAUNCH_ARGS,
      })
    : await chromium.connectOverCDP(target.endpoint, { timeout: 30_000 });
  const browserSession = await browser.newBrowserCDPSession();

  let deviceScaleFactor = 1;
  if (local && dpr === 'native') deviceScaleFactor = await nativeDpr(browser);
  const size = viewport === 'native' ? null : { width: viewport.w, height: viewport.h };

  // A page that clicks its own download link must not write a file on the machine it runs on
  // (on the board that would be its disk). A launched browser's contexts say so themselves.
  if (!local) {
    await browserSession
      .send('Browser.setDownloadBehavior', { behavior: 'deny' })
      .catch(() => undefined);
  }

  // The page calls the harness through bindings that every page of a context has; one listener at
  // a time, the run on screen, hears them.
  const listener = { current: null };
  const bound = new WeakSet();
  const bind = async (context) => {
    if (bound.has(context)) return;
    bound.add(context);
    await context.exposeBinding('benchEvent', (_source, event) => listener.current?.onEvent(event));
    await context.exposeBinding('benchInput', (_source, event) =>
      listener.current?.onInput?.(event),
    );
  };

  return {
    browser,
    local,
    /** A context and page for one run; `release()` closes what it made. */
    async session() {
      let context;
      let ownsContext = false;
      if (local) {
        context = await browser.newContext({
          viewport: size,
          deviceScaleFactor: size ? deviceScaleFactor : undefined,
          acceptDownloads: false,
        });
        ownsContext = true;
      } else {
        context = browser.contexts()[0] ?? (await browser.newContext());
        ownsContext = browser.contexts()[0] === undefined;
      }
      await bind(context);
      const page = await context.newPage();
      if (!local && size) await page.setViewportSize(size);
      return {
        context,
        page,
        browser,
        listener,
        async release() {
          await withTimeout(page.close({ runBeforeUnload: false }), 10_000, 'close page').catch(
            () => undefined,
          );
          if (ownsContext) {
            await withTimeout(context.close(), 10_000, 'close context').catch(() => undefined);
          }
        },
      };
    },
    /** What the browser says about the machine: GPU feature status and its command line. */
    async facts() {
      const info = await withTimeout(
        browserSession.send('SystemInfo.getInfo'),
        15_000,
        'SystemInfo.getInfo',
      );
      return {
        gpu: {
          featureStatus: info.gpu.featureStatus,
          devices: info.gpu.devices,
          driverBugWorkarounds: info.gpu.driverBugWorkarounds,
        },
        launchArgs: info.commandLine ? info.commandLine.split(/\s+/).filter(Boolean) : [],
        version: browser.version(),
      };
    },
    browserSession,
    async close() {
      await withTimeout(browser.close(), 15_000, 'close browser').catch(() => undefined);
    },
  };
}

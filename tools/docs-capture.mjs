/*
 * Pictures of the showcase's examples for the Markdown docs: each example's live area, in light
 * and in dark, as WebP under `docs/images/<topic>/<example>.<scheme>.webp`.
 *
 *   npm run docs:capture                         build the showcase, then capture every example
 *   npm run docs:capture -- --topic button,bev   only these topics
 *   node tools/docs-capture.mjs --help           the options, without building first
 *
 * How it works: it serves the built showcase (`dist/showcase/browser`) on a local port and opens
 * each topic's page in Chrome through Playwright, at a fixed viewport and pixel ratio, with reduced
 * motion and the docs page's side panel closed, so every run frames the examples alike. The scheme
 * comes from the kit's stored choice (`neat-ui:color-scheme`), as a user's would. An example is
 * its card's live area; a page example (`@page`) is the showcase's content area on its own route.
 * The topics and their addresses come from the showcase's own `topics.ts` and `docs-routes.ts`, so
 * the list cannot drift from the routes. Hand-made topics (the theme's tokens) have no examples
 * and are left out.
 *
 * Chrome encodes the WebP (a canvas's `toBlob`), so there is no image library to install. The
 * live area's rounded corners are cut out of the picture, transparent, so it sits on GitHub's page
 * in either theme without the showcase's card around it.
 *
 * It never fails over sizes: past the budget (per picture and in all) it warns, since a picture a
 * little over is better than none. Nor does it delete: a picture under `docs/images` that no
 * example produced (its example was renamed or removed) is listed for you to delete.
 */
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const DEFAULTS = {
  dist: 'dist/showcase/browser',
  out: 'docs/images',
  /** Wide enough that a topic's examples get a desktop card's width, with the panel closed. */
  viewport: { width: 1280, height: 900 },
  /** Sharp on a high-density screen; GitHub scales the picture down to its column. */
  dpr: 2,
  /** WebP quality, 0 to 1. */
  quality: 0.85,
  /** How long an example runs before its picture is taken, so live data has arrived. */
  settleMs: 1200,
  channel: 'chrome',
  /** Warn past these: one picture, and all of them together. */
  budget: { pictureBytes: 150 * 1024, totalBytes: 25 * 1024 * 1024 },
};

export const SCHEMES = ['light', 'dark'];

/** The kit's stored color scheme (ThemeService) and the docs page's side panel (docs-page.ts). */
const SCHEME_KEY = 'neat-ui:color-scheme';
const DOCS_ASIDE_OPEN_KEY = 'neat-ui-showcase:docs-aside-open';

const HELP = `Usage: node tools/docs-capture.mjs [options]

Captures every example of the built showcase in light and dark as WebP under docs/images.
Build the showcase first (npm run docs:capture does both).

  --topic <ids>      only these topics, comma-separated (button,bev)
  --out <dir>        where the pictures go (${DEFAULTS.out})
  --dist <dir>       the built showcase (${DEFAULTS.dist})
  --channel <name>   Playwright's browser channel (${DEFAULTS.channel}: the installed Google
                     Chrome; chromium after \`npx playwright install chromium\`)
  --settle <ms>      how long each example runs before its picture (${DEFAULTS.settleMs})
  --help             this text`;

/** The options from the command line's arguments; throws with the reason for one it cannot read. */
export function parseArgs(argv) {
  const options = { ...DEFAULTS, topics: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--topic') options.topics = value().split(',').filter(Boolean);
    else if (arg === '--out') options.out = value();
    else if (arg === '--dist') options.dist = value();
    else if (arg === '--channel') options.channel = value();
    else if (arg === '--settle') {
      const ms = Number(value());
      if (!Number.isFinite(ms) || ms < 0) throw new Error('--settle takes a number of ms');
      options.settleMs = ms;
    } else throw new Error(`unknown option ${arg} (--help lists them)`);
  }
  return options;
}

/**
 * The topics to capture, in rail order, each with its address: every topic generated from the
 * kit (`load`), or those `only` names. Throws for a name in `only` that is no such topic.
 */
export function topicsToCapture(groups, placedTopics, only = null) {
  const all = groups.flatMap(placedTopics).filter(({ topic }) => topic.load);
  if (!only) return all.map(({ topic, path }) => ({ id: topic.id, path }));
  const unknown = only.filter((id) => !all.some(({ topic }) => topic.id === id));
  if (unknown.length) throw new Error(`no such topic with examples: ${unknown.join(', ')}`);
  return all
    .filter(({ topic }) => only.includes(topic.id))
    .map(({ topic, path }) => ({ id: topic.id, path }));
}

/** Where an example's picture goes, relative to the output folder. */
export const picturePath = (topic, example, scheme) => `${topic}/${example}.${scheme}.webp`;

/** The warnings for pictures past the budget, biggest first, then one for the total. */
export function budgetWarnings(pictures, budget = DEFAULTS.budget) {
  const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;
  const warnings = [...pictures]
    .filter(({ bytes }) => bytes > budget.pictureBytes)
    .sort((a, b) => b.bytes - a.bytes)
    .map(({ path, bytes }) => `${path} is ${kb(bytes)}, over ${kb(budget.pictureBytes)}`);
  const total = pictures.reduce((sum, { bytes }) => sum + bytes, 0);
  if (total > budget.totalBytes) {
    warnings.push(`the pictures are ${kb(total)} in all, over ${kb(budget.totalBytes)}`);
  }
  return warnings;
}

/** The pictures in `existing` (paths relative to the output folder) that this run did not make. */
export function stalePictures(existing, made) {
  const madeSet = new Set(made);
  return existing.filter((path) => path.endsWith('.webp') && !madeSet.has(path)).sort();
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * The file under `root` that serves `urlPath`, or null for one outside it. The showcase routes
 * by path, so an address with no file extension is the app's `index.html`.
 */
export function fileFor(root, urlPath) {
  let path;
  try {
    path = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (!extname(path)) return join(root, 'index.html');
  const file = resolve(root, `.${path.startsWith('/') ? path : `/${path}`}`);
  return file.startsWith(root + sep) ? file : null;
}

/** Serves the built app in `root` on a free local port; resolves with its URL and `close()`. */
export function serve(root) {
  const base = resolve(root);
  const server = createServer(async (request, response) => {
    const file = fileFor(base, request.url ?? '/');
    const found = file && (await stat(file).catch(() => null))?.isFile();
    if (!found) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      done({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((closed) => server.close(closed)),
      });
    });
  });
}

/** Every file under `dir`, as paths relative to it; none when it does not exist. */
async function filesUnder(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
}

/**
 * In the page: the PNG (base64) as WebP (base64), its corners cut to `radius` CSS px, transparent.
 * Runs in Chrome, whose canvas encodes WebP.
 */
async function encodeInPage({ png, radius, dpr, quality }) {
  const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
  const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  if (radius > 0) {
    context.beginPath();
    context.roundRect(0, 0, image.width, image.height, radius * dpr);
    context.clip();
  }
  context.drawImage(image, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  if (blob.type !== 'image/webp') throw new Error(`the browser encoded ${blob.type}, not WebP`);
  const out = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < out.length; i += 0x8000) {
    text += String.fromCharCode(...out.subarray(i, i + 0x8000));
  }
  return btoa(text);
}

/** In the page: the examples of the open topic, each with whether it is a page and its radius. */
function examplesInPage() {
  return [...document.querySelectorAll('app-example-card article')].map((article) => {
    const id = article.querySelector('h3')?.id.replace(/^example-/, '') ?? '';
    const live = article.querySelector('.live');
    const page = article.querySelector('a[href^="/demo/"]')?.getAttribute('href') ?? null;
    const radius = live ? parseFloat(getComputedStyle(live).borderTopLeftRadius) || 0 : 0;
    return { id, live: Boolean(live), page, radius };
  });
}

async function settle(page, ms) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

/** Captures one scheme of every topic; resolves with the pictures written. */
async function captureScheme(browser, { scheme, url, topics, options, encoder, log }) {
  const context = await browser.newContext({
    viewport: options.viewport,
    deviceScaleFactor: options.dpr,
    reducedMotion: 'reduce',
    colorScheme: scheme,
  });
  await context.addInitScript(
    ([schemeKey, scheme, asideKey]) => {
      localStorage.setItem(schemeKey, scheme);
      localStorage.setItem(asideKey, 'false');
    },
    [SCHEME_KEY, scheme, DOCS_ASIDE_OPEN_KEY],
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => log(`  page error: ${error.message}`));
  const pictures = [];
  const write = async (topic, example, png, radius) => {
    const webp = await encoder.evaluate(encodeInPage, {
      png: png.toString('base64'),
      radius,
      dpr: options.dpr,
      quality: options.quality,
    });
    const path = picturePath(topic, example, scheme);
    const file = join(options.out, path);
    await mkdir(join(options.out, topic), { recursive: true });
    const bytes = Buffer.from(webp, 'base64');
    await writeFile(file, bytes);
    pictures.push({ path, bytes: bytes.length });
  };

  for (const topic of topics) {
    await page.goto(`${url}${topic.path}`);
    await page.locator('app-example-card article').first().waitFor();
    const examples = await page.evaluate(examplesInPage);
    for (const example of examples.filter((e) => e.live)) {
      const area = page.locator(`app-example-card article:has(h3#example-${example.id}) .live`);
      await area.scrollIntoViewIfNeeded();
      await settle(page, options.settleMs);
      await write(topic.id, example.id, await area.screenshot(), example.radius);
    }
    for (const example of examples.filter((e) => e.page)) {
      await page.goto(`${url}${example.page}`);
      await settle(page, options.settleMs);
      await write(topic.id, example.id, await page.locator('main.content').first().screenshot(), 0);
    }
    log(`  ${scheme} ${topic.id}: ${examples.filter((e) => e.live || e.page).length}`);
  }
  await context.close();
  return pictures;
}

/** The whole run: serve, capture both schemes, then report the budget and stale pictures. */
export async function capture(options, log = console.log) {
  const [{ GROUPS }, { placedTopics }, { chromium }] = await Promise.all([
    import(pathToFileURL(join(ROOT, 'projects/showcase/src/app/docs/topics.ts')).href),
    import(pathToFileURL(join(ROOT, 'projects/showcase/src/app/docs/docs-routes.ts')).href),
    import('playwright'),
  ]);
  const topics = topicsToCapture(GROUPS, placedTopics, options.topics);
  const dist = resolve(ROOT, options.dist);
  if (!(await stat(join(dist, 'index.html')).catch(() => null))) {
    throw new Error(`no built showcase in ${options.dist}: run npm run build:showcase first`);
  }
  const out = resolve(ROOT, options.out);
  const server = await serve(dist);
  const browser = await chromium.launch({
    channel: options.channel,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const encoder = await browser.newPage();
    log(`Capturing ${topics.length} topics from ${server.url}`);
    const pictures = [];
    for (const scheme of SCHEMES) {
      const run = { scheme, url: server.url, topics, options: { ...options, out }, encoder, log };
      pictures.push(...(await captureScheme(browser, run)));
    }
    const total = pictures.reduce((sum, { bytes }) => sum + bytes, 0);
    log(`Wrote ${pictures.length} pictures, ${Math.round(total / 1024)} kB, to ${options.out}`);
    for (const warning of budgetWarnings(pictures, options.budget)) log(`warning: ${warning}`);
    if (!options.topics) {
      const stale = stalePictures(
        await filesUnder(out),
        pictures.map(({ path }) => path),
      );
      if (stale.length) {
        log(`No example makes these any more; delete them if their examples are gone:`);
        for (const path of stale) log(`  ${options.out}/${path}`);
      }
    }
    return pictures;
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  if (options.help) {
    console.log(HELP);
  } else {
    capture(options).catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
  }
}

/*
 * Pictures of the showcase's examples for the Markdown docs: each example's live area, in light
 * and in dark, as WebP under `docs/images/<topic>/<example>.<scheme>.webp`, and for an example
 * marked `@animated` an animation of it as well, `<example>.<scheme>.animated.webp`. An example
 * marked `@unpictured` gets neither.
 *
 *   npm run docs:capture                         build the showcase, then capture every example
 *   npm run docs:capture -- --topic button,bev   only these topics
 *   npm run docs:capture -- --gallery            only the README gallery's pictures (`@gallery`)
 *   npm run docs:capture -- --only animations    only the animations (or `stills`)
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
 * An example whose content opens in an overlay (a popover, a tooltip, a dialog, a toast) says what
 * to do first in its class doc, `@capture click <selector>` or `@capture hover <selector>`, which
 * docs:emit checks: the tool clicks every element the selector matches in the example (or hovers
 * the first) and pictures the example with what opened beside it, or what opened alone when it is
 * modal or far from it (`pictureFrame`).
 *
 * Chrome encodes the WebP (a canvas's `toBlob`), so there is no image library to install. The
 * live area's rounded corners are cut out of the picture, transparent, so it sits on GitHub's page
 * in either theme without the showcase's card around it.
 *
 * An animation (`@animated`, for an example whose point is motion: a live chart, the bird's-eye
 * view) is taken in a context of its own, without reduced motion, under Playwright's fake clock:
 * after the example settles, the clock is paused and stepped one frame at a time (`animation`),
 * and the page's CSS animations are stepped with it, so every frame is the same time apart
 * whatever a screenshot costs. Each frame is cut to the still's framing in Chrome, losslessly
 * (PNG), and sharp (libwebp) joins the frames into a lossless animated WebP at its slowest,
 * smallest setting: the kit's flat colors and sharp edges come out smaller lossless than lossy,
 * and with no artifacts. Moving blur is the exception (the message box's glows: 2.7 MB lossless,
 * 400 kB lossy), so an example tagged `@animated lossy` is encoded lossy (`animationEncoding`).
 * The animation is taken at the stills' pixel ratio, so the docs show both at one width. Media
 * that plays on the browser's own clock (a `<video>`) is not stepped.
 *
 * It never fails over sizes: past the budget (per picture, per animation and in all) it warns,
 * since a picture a little over is better than none. Nor does it delete: a picture under
 * `docs/images` that no example produced (its example was renamed or removed) is listed for you
 * to delete.
 */
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pictureFile } from './docs-pages.mjs';
import { fakeMediaFlags, writeFakeVoice } from './fake-voice.mjs';

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
  /** An animation's length and frames per second; it loops. */
  animation: { ms: 4000, fps: 10 },
  channel: 'chrome',
  /** What to take: `all`, `stills` or `animations`. */
  only: 'all',
  /** Warn past these: one picture, one animation, and all of them together. */
  budget: {
    pictureBytes: 150 * 1024,
    animationBytes: 400 * 1024,
    totalBytes: 40 * 1024 * 1024,
  },
};

/** What `--only` takes. */
/** The quality of an animation tagged `@animated lossy`. */
const LOSSY_QUALITY = 85;

/**
 * How an animation's frames are joined, by sharp (libwebp): losslessly at its slowest, smallest
 * setting, or, for an example tagged `@animated lossy`, lossy at `LOSSY_QUALITY` with its
 * transparent corners kept whole. Each frame shows for `step` ms, and the animation loops.
 */
export function animationEncoding(animation, step, frames) {
  const encoding = animation?.lossy
    ? { quality: LOSSY_QUALITY, alphaQuality: 100, smartSubsample: true }
    : { lossless: true };
  return { ...encoding, effort: 6, minSize: true, loop: 0, delay: Array(frames).fill(step) };
}

export const TAKES = ['all', 'stills', 'animations'];

export const SCHEMES = ['light', 'dark'];

/** How long an action of `@capture` may wait for its target. */
const ACT_TIMEOUT_MS = 5000;

/** The kit's stored color scheme (ThemeService) and the docs page's side panel (docs-page.ts). */
const SCHEME_KEY = 'neat-ui:color-scheme';
const DOCS_ASIDE_OPEN_KEY = 'neat-ui-showcase:docs-aside-open';

const HELP = `Usage: node tools/docs-capture.mjs [options]

Captures every example of the built showcase in light and dark as WebP under docs/images,
and animates the examples marked @animated. Build the showcase first (npm run docs:capture
does both).

  --topic <ids>      only these topics, comma-separated (button,bev)
  --gallery          only the examples marked @gallery, the README gallery's pictures
  --only <what>      stills or animations (the @animated examples'); both by default
  --out <dir>        where the pictures go (${DEFAULTS.out})
  --dist <dir>       the built showcase (${DEFAULTS.dist})
  --channel <name>   Playwright's browser channel (${DEFAULTS.channel}: the installed Google
                     Chrome; chromium after \`npx playwright install chromium\`)
  --settle <ms>      how long each example runs before its picture (${DEFAULTS.settleMs})
  --help             this text`;

/** The options from the command line's arguments; throws with the reason for one it cannot read. */
export function parseArgs(argv) {
  const options = { ...DEFAULTS, topics: null, gallery: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--topic') options.topics = value().split(',').filter(Boolean);
    else if (arg === '--gallery') options.gallery = true;
    else if (arg === '--only') {
      options.only = value();
      if (!TAKES.includes(options.only)) throw new Error(`--only takes ${TAKES.join(', ')}`);
    } else if (arg === '--out') options.out = value();
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

/**
 * Where an example's picture goes, relative to the output folder, or its animation's: the names
 * docs:pages and the README's gallery read (`pictureFile` in `docs-pages.mjs`).
 */
export const picturePath = (topic, example, scheme, animated = false) =>
  pictureFile(`${topic}/${example}`, scheme, animated);

/**
 * The warnings for pictures past the budget (an animation's, `animated`, is its own), biggest
 * first, then one for the total.
 */
export function budgetWarnings(pictures, budget = DEFAULTS.budget) {
  const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;
  const limit = ({ animated }) => (animated ? budget.animationBytes : budget.pictureBytes);
  const warnings = [...pictures]
    .filter((picture) => picture.bytes > limit(picture))
    .sort((a, b) => b.bytes - a.bytes)
    .map((picture) => `${picture.path} is ${kb(picture.bytes)}, over ${kb(limit(picture))}`);
  const total = pictures.reduce((sum, { bytes }) => sum + bytes, 0);
  if (total > budget.totalBytes) {
    warnings.push(`the pictures are ${kb(total)} in all, over ${kb(budget.totalBytes)}`);
  }
  return warnings;
}

/** The smallest box around `rects`. */
const union = (rects) => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
};

/** Whether `a` and `b` overlap once `a` is grown by `reach` on every side. */
const near = (a, b, reach) =>
  b.x < a.x + a.width + reach &&
  a.x - reach < b.x + b.width &&
  b.y < a.y + a.height + reach &&
  a.y - reach < b.y + b.height;

/**
 * The part of an example's live `area` its picture shows: the `content` (the box around what the
 * example draws) with the area's own `padding` around it, inside the area's `border`, which the
 * picture leaves out so that no edge of it is cut in half. A wide area whose example draws a row of
 * small controls becomes a picture of the controls, not of an empty strip. No content (nothing
 * measured) keeps the whole area, inside its border.
 */
export function trimToContent(area, content, { border = 0, padding = 0 } = {}) {
  const inner = {
    x: area.x + border,
    y: area.y + border,
    right: area.x + area.width - border,
    bottom: area.y + area.height - border,
  };
  const box = content
    ? {
        x: Math.max(inner.x, content.x - padding),
        y: Math.max(inner.y, content.y - padding),
        right: Math.min(inner.right, content.x + content.width + padding),
        bottom: Math.min(inner.bottom, content.y + content.height + padding),
      }
    : inner;
  return {
    x: box.x,
    y: box.y,
    width: Math.max(0, box.right - box.x),
    height: Math.max(0, box.bottom - box.y),
    radius: Math.max(0, area.radius - border),
  };
}

/**
 * Where the picture of an example opened by `@capture` is taken (`clip`, CSS px of the viewport,
 * kept inside it) and what of it is drawn (`shapes`, rounded boxes relative to the clip; the rest
 * is transparent): the example's `area` with the overlay's `surfaces` when they open beside it (a
 * popover, a tooltip, a select's list, which touch their trigger); the surfaces alone when they
 * are `modal` (a dialog, over a dimmed page) or open away from it (toasts in the screen's corner);
 * the area alone when nothing opened. So the picture holds the example and what it opened, never
 * the docs page around them.
 */
export function pictureFrame({ area, surfaces, modal, viewport, reach = 32 }) {
  let shapes = [area];
  if (surfaces.length) {
    shapes = !modal && near(area, union(surfaces), reach) ? [area, ...surfaces] : surfaces;
  }
  const frame = union(shapes);
  const x = Math.max(0, Math.floor(frame.x));
  const y = Math.max(0, Math.floor(frame.y));
  const right = Math.min(viewport.width, Math.ceil(frame.x + frame.width));
  const bottom = Math.min(viewport.height, Math.ceil(frame.y + frame.height));
  return {
    clip: { x, y, width: right - x, height: bottom - y },
    shapes: shapes.map(({ x: sx, y: sy, width, height, radius }) => ({
      x: sx - x,
      y: sy - y,
      width,
      height,
      radius,
    })),
  };
}

// --- scripts (`@play`) ---------------------------------------------------------------------------

/** How long the cursor takes to reach a step's target, and how long a step holds after it acts. */
export const PLAY_TIMING = { moveMs: 600, holdMs: 700, pressMs: 150, tailMs: 1000 };

/**
 * When each step of a script happens, in ms from the animation's start: a hover or a click moves
 * the cursor from `start` to its target, acts on `arrive` and holds until `end`; a wait holds for
 * its time. `total` leaves `tailMs` after the last step, so the end state shows before the loop.
 */
export function playTimeline(steps, timing = PLAY_TIMING) {
  let at = 0;
  const timeline = steps.map((step) => {
    if (step.action === 'wait') {
      const entry = { ...step, start: at, arrive: at, end: at + step.ms };
      at = entry.end;
      return entry;
    }
    const entry = {
      ...step,
      start: at,
      arrive: at + timing.moveMs,
      end: at + timing.moveMs + timing.holdMs,
    };
    at = entry.end;
    return entry;
  });
  return { steps: timeline, total: at + timing.tailMs };
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Where the cursor is at `t` ms: at `from` until the first move, gliding (eased) to each target
 * while its step moves, then resting there. `points[i]` is step i's target point, null for a
 * wait. Pressed for `pressMs` after a click acts.
 */
export function cursorAt(timeline, points, from, t, timing = PLAY_TIMING) {
  let position = from;
  let pressed = false;
  timeline.steps.forEach((step, i) => {
    const point = points[i];
    if (!point || t < step.start) return;
    if (t < step.arrive) {
      const k = easeInOut((t - step.start) / (step.arrive - step.start));
      position = {
        x: position.x + (point.x - position.x) * k,
        y: position.y + (point.y - position.y) * k,
      };
    } else {
      position = point;
      if (step.action === 'click' && t < step.arrive + timing.pressMs) pressed = true;
    }
  });
  return { ...position, pressed };
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
 * In the page: the PNG (base64) as WebP (base64), cut to `crop` (CSS px of the PNG; all of it when
 * null) and drawn only inside `shapes` (rounded boxes in CSS px of the crop), the rest transparent.
 * Runs in Chrome, whose canvas encodes WebP; `type` `image/png` keeps an animation's frame
 * lossless for sharp.
 */
async function encodeInPage({ png, crop, shapes, dpr, quality, type = 'image/webp', cursor }) {
  const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
  const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const cut = crop
    ? {
        x: Math.round(crop.x * dpr),
        y: Math.round(crop.y * dpr),
        width: Math.round(crop.width * dpr),
        height: Math.round(crop.height * dpr),
      }
    : { x: 0, y: 0, width: image.width, height: image.height };
  const canvas = new OffscreenCanvas(cut.width, cut.height);
  const context = canvas.getContext('2d');
  context.beginPath();
  for (const { x, y, width, height, radius } of shapes) {
    context.roundRect(x * dpr, y * dpr, width * dpr, height * dpr, radius * dpr);
  }
  context.save();
  context.clip();
  context.drawImage(image, -cut.x, -cut.y);
  context.restore();
  if (cursor) {
    // The pointer as systems draw it, its tip on the point, dark with a light rim, a little
    // smaller while pressed.
    const scale = dpr * 1.25 * (cursor.pressed ? 0.85 : 1);
    context.save();
    context.translate(cursor.x * dpr, cursor.y * dpr);
    context.scale(scale, scale);
    const arrow = new Path2D('M0 0 L0 16 L4.2 12.3 L7 18.6 L9.6 17.5 L6.9 11.3 L12 11.3 Z');
    context.lineJoin = 'round';
    context.lineWidth = 1.6;
    context.strokeStyle = 'white';
    context.fillStyle = 'black';
    context.stroke(arrow);
    context.fill(arrow);
    context.restore();
  }
  const blob = await canvas.convertToBlob({ type, quality });
  if (blob.type !== type) throw new Error(`the browser encoded ${blob.type}, not ${type}`);
  const out = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < out.length; i += 0x8000) {
    text += String.fromCharCode(...out.subarray(i, i + 0x8000));
  }
  if (type !== 'image/png') return btoa(text);
  // A frame also says the box of what it draws, so the frames can be cut to what any of them shows.
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let [x0, y0, x1, y1] = [width, height, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!data[(y * width + x) * 4 + 3]) continue;
      if (x < x0) x0 = x;
      if (x >= x1) x1 = x + 1;
      if (y < y0) y0 = y;
      if (y >= y1) y1 = y + 1;
    }
  }
  return {
    png: btoa(text),
    box: x1 > x0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null,
  };
}

/** In the page: the examples of the open topic, each rendered in its card or a page's link. */
function examplesInPage() {
  return [...document.querySelectorAll('app-example-card article')].map((article) => {
    const id = article.querySelector('h3')?.id.replace(/^example-/, '') ?? '';
    const live = Boolean(article.querySelector('.live'));
    const page = article.querySelector('a[href^="/demo/"]')?.getAttribute('href') ?? null;
    return { id, live, page };
  });
}

/**
 * In the page: the box of `selector`'s first match with its corner radius, the surfaces of the
 * open overlay (in the CDK's panes, as every overlay of the kit is: each outermost element with a
 * background, so a stack of toasts is its toasts and not the gaps between them), and whether a
 * modal's backdrop is showing. Hidden parts (the toasts' announcer) are too small to count.
 */
function framingInPage({ selector, trim }) {
  const shape = (element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
    return { x, y, width, height, radius };
  };
  const clear = (color) => {
    const c = color.replace(/\s+/g, '');
    return c === 'transparent' || /,0\)$|\/0\)$/.test(c);
  };
  // A surface has a fill, or a border or a ring of its own.
  const painted = (element) => {
    const style = getComputedStyle(element);
    const bordered = parseFloat(style.borderTopWidth) > 0 && !clear(style.borderTopColor);
    const filled = !clear(style.backgroundColor) || style.backgroundImage !== 'none';
    return filled || bordered || ring(element) > 0;
  };
  // A ring (Tailwind's `ring`, the kit's panels' edge) is a box-shadow with no offset and no blur,
  // drawn outside the box: the surface grows by its spread so the picture keeps it.
  const ring = (element) => {
    const shadows = getComputedStyle(element).boxShadow.split(/,(?![^(]*\))/);
    const spreads = shadows.map((shadow) => {
      const px = shadow.match(/(-?[\d.]+)px/g)?.map(parseFloat) ?? [];
      return px.length === 4 && px[0] === 0 && px[1] === 0 && px[2] === 0 ? px[3] : 0;
    });
    return Math.max(0, ...spreads);
  };
  const surface = (element) => {
    const { x, y, width, height, radius } = shape(element);
    const r = ring(element);
    return { x: x - r, y: y - r, width: width + 2 * r, height: height + 2 * r, radius: radius + r };
  };
  const surfaces = [];
  const visit = (element) => {
    if (painted(element)) surfaces.push(surface(element));
    else for (const child of element.children) visit(child);
  };
  for (const pane of document.querySelectorAll('.cdk-overlay-pane')) visit(pane);

  // What the example draws: its text, its painted boxes and its drawings (a canvas, an SVG, a
  // video), each taken whole, and nothing hidden (a visually hidden live region is 1 px).
  const target = document.querySelector(selector);
  const DRAWN = new Set(['svg', 'canvas', 'img', 'video', 'input', 'select', 'textarea', 'button']);
  const drawn = [];
  const add = (r) => r.width > 1 && r.height > 1 && drawn.push(r);
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        add(range.getBoundingClientRect());
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          continue;
        }
        const r = child.getBoundingClientRect();
        // A box with no size of its own (`display: contents`, a host of absolutely placed
        // parts) can still hold what is drawn; one that clips to nothing (visually hidden) cannot.
        const empty = r.width <= 1 || r.height <= 1;
        if (empty && style.overflow !== 'visible') continue;
        if (!empty && (DRAWN.has(child.localName) || painted(child))) {
          add(surface(child));
          // An SVG may draw past its own box (overflow visible, as the diagram's edges that loop
          // round a block): its shapes are measured too.
          if (child.localName === 'svg') {
            const shapes = 'path, line, polyline, polygon, rect, circle, ellipse, text';
            for (const shape of child.querySelectorAll(shapes)) add(shape.getBoundingClientRect());
          }
        } else walk(child);
      }
    }
  };
  if (trim) walk(target);
  const content = drawn.length
    ? (() => {
        const x = Math.min(...drawn.map((r) => r.x));
        const y = Math.min(...drawn.map((r) => r.y));
        const right = Math.max(...drawn.map((r) => r.x + r.width));
        const bottom = Math.max(...drawn.map((r) => r.y + r.height));
        return { x, y, width: right - x, height: bottom - y };
      })()
    : null;
  const style = getComputedStyle(target);
  return {
    area: shape(target),
    content,
    inset: trim
      ? {
          border: parseFloat(style.borderTopWidth) || 0,
          padding: parseFloat(style.paddingTop) || 0,
        }
      : { border: 0, padding: 0 },
    surfaces: surfaces.filter(({ width, height }) => width > 8 && height > 8),
    modal: Boolean(document.querySelector('.cdk-overlay-backdrop-showing')),
  };
}

/**
 * Does what the example's `@capture` says inside `scope`: clicks every element the selector
 * matches, in order (each of a toast example's buttons), or hovers the first. Says so when it
 * matches nothing, and the picture is taken as the example is.
 */
async function act(scope, capture, log) {
  const targets = scope.locator(capture.target);
  const count = await targets.count();
  if (!count) {
    log(`  warning: @capture ${capture.action} ${capture.target} matches nothing`);
    return;
  }
  // A target that cannot take the action (covered by a modal the first click opened, disabled)
  // is said once, and the picture shows what the actions so far opened.
  try {
    if (capture.action === 'hover') await targets.first().hover({ timeout: ACT_TIMEOUT_MS });
    else for (let i = 0; i < count; i++) await targets.nth(i).click({ timeout: ACT_TIMEOUT_MS });
  } catch (error) {
    log(`  warning: @capture ${capture.action} ${capture.target}: ${error.message.split('\n')[0]}`);
  }
}

async function settle(page, ms) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

/**
 * The part of an example's area its picture shows, as `crop` (CSS px of the area's screenshot)
 * and the rounded `shape` drawn inside it: the area trimmed to what the example draws (`trim`),
 * or the whole area. A still and its animation are framed alike.
 */
async function areaFrame(page, area, selector, trim) {
  const box = await area.boundingBox();
  const framed = await page.evaluate(framingInPage, { selector, trim });
  const part = trimToContent(framed.area, framed.content, framed.inset);
  return {
    crop: { x: part.x - box.x, y: part.y - box.y, width: part.width, height: part.height },
    shape: { x: 0, y: 0, width: part.width, height: part.height, radius: part.radius },
  };
}

/**
 * In the page: makes the example's controls that `@hide` names invisible but still there, so the
 * script still drives them and the framing leaves them out (it skips what has no opacity).
 */
function hideInPage({ selector, hide }) {
  for (const element of document.querySelector(selector)?.querySelectorAll(hide) ?? []) {
    // At once: a transition would hold the control half-visible under the paused clock.
    element.style.transition = 'none';
    element.style.opacity = '0';
  }
}

/**
 * The viewport point a step acts on: its target's first match in the example (`scope`), at `at`
 * percent of its box, its middle by default; null, said once, when it matches nothing.
 */
async function targetPoint(scope, step, log) {
  const box = await scope.locator(step.target).first().boundingBox();
  if (!box) {
    log(`  warning: @play ${step.action} ${step.target} matches nothing`);
    return null;
  }
  const { x = 50, y = 50 } = step.at ?? {};
  return { x: box.x + (box.width * x) / 100, y: box.y + (box.height * y) / 100 };
}

/** Runs a script at once for a still: each step acts, a wait waits. Leaves the end state. */
async function playThrough(page, scope, steps, log) {
  for (const step of steps) {
    if (step.action === 'wait') {
      await page.waitForTimeout(step.ms);
      continue;
    }
    const point = await targetPoint(scope, step, log);
    if (!point) continue;
    await page.mouse.move(point.x, point.y, { steps: 4 });
    if (step.action === 'click') await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(PLAY_TIMING.holdMs);
  }
}

/** In the page: pauses every CSS animation and moves it on by `ms`, as the fake clock moves. */
function stepAnimationsInPage(ms) {
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = Number(animation.currentTime ?? 0) + ms;
  }
}

/** Captures one scheme of every topic; resolves with the pictures written. */
async function captureScheme(browser, run) {
  const { scheme, url, topics, examplesOf, options, encoder, log } = run;
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
  const write = async (topic, example, png, crop, shapes) => {
    const webp = await encoder.evaluate(encodeInPage, {
      png: png.toString('base64'),
      crop,
      shapes,
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

  // An example's picture: its area, or with `@capture` what it opens, framed by `pictureFrame`.
  // A live area is trimmed to what its example draws; a page example's content area is the page.
  const take = async (topic, example, selector, trim) => {
    const area = page.locator(selector).first();
    const read = examplesOf.get(`${topic.id}/${example.id}`);
    const capture = read?.capture;
    const scripted = Boolean(read?.play || read?.hide);
    const framing = async () => {
      const framed = await page.evaluate(framingInPage, { selector, trim });
      return { ...framed, area: trimToContent(framed.area, framed.content, framed.inset) };
    };
    if (scripted) {
      // The state its script leaves, framed with what it opened, as for `@capture`.
      await area.evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await settle(page, options.settleMs);
      if (read.hide) await page.evaluate(hideInPage, { selector, hide: read.hide });
      await playThrough(page, area, read.play ?? [], log);
      await settle(page, options.settleMs);
      const { clip, shapes } = pictureFrame({ ...(await framing()), viewport: options.viewport });
      await write(topic.id, example.id, await page.screenshot({ clip }), null, shapes);
      return true;
    }
    if (!capture) {
      // The area alone, whole even when it is taller than the viewport, then cut to its part.
      await area.scrollIntoViewIfNeeded();
      await settle(page, options.settleMs);
      const { crop, shape } = await areaFrame(page, area, selector, trim);
      await write(topic.id, example.id, await area.screenshot(), crop, [shape]);
      return false;
    }
    // In the middle of the viewport, so what it opens has room on every side.
    await area.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await settle(page, options.settleMs);
    await act(area, capture, log);
    await settle(page, options.settleMs);
    const { clip, shapes } = pictureFrame({ ...(await framing()), viewport: options.viewport });
    await write(topic.id, example.id, await page.screenshot({ clip }), null, shapes);
    return true;
  };
  const openTopic = async (topic) => {
    await page.goto(`${url}${topic.path}`);
    await page.locator('app-example-card article').first().waitFor();
  };

  for (const topic of topics) {
    await openTopic(topic);
    const examples = (await page.evaluate(examplesInPage)).filter((example) => {
      const read = examplesOf.get(`${topic.id}/${example.id}`);
      return !read?.unpictured && (!options.gallery || read?.gallery);
    });
    for (const example of examples.filter((e) => e.live)) {
      const selector = `app-example-card article:has(h3#example-${example.id}) .live`;
      // What an example opened stays open, so the next one starts on a fresh page.
      if (await take(topic, example, selector, true)) await openTopic(topic);
    }
    for (const example of examples.filter((e) => e.page)) {
      await page.goto(`${url}${example.page}`);
      await take(topic, example, 'main.content', false);
    }
    log(`  ${scheme} ${topic.id}: ${examples.filter((e) => e.live || e.page).length}`);
  }
  await context.close();
  return pictures;
}

/**
 * Animates one scheme of every `@animated` example of `topics`; resolves with the animations
 * written. The examples run as they would for a reader, without reduced motion, under the fake
 * clock: real time until each has settled, then paused and stepped a frame at a time.
 */
async function animateScheme(browser, run) {
  const { scheme, url, topics, examplesOf, options, encoder, log } = run;
  const { default: sharp } = await import('sharp');
  const context = await browser.newContext({
    viewport: options.viewport,
    deviceScaleFactor: options.dpr,
    reducedMotion: 'no-preference',
    colorScheme: scheme,
  });
  await context.addInitScript(
    ([schemeKey, scheme, asideKey]) => {
      localStorage.setItem(schemeKey, scheme);
      localStorage.setItem(asideKey, 'false');
    },
    [SCHEME_KEY, scheme, DOCS_ASIDE_OPEN_KEY],
  );
  // Playwright's clock fakes performance.now() and requestAnimationFrame's time, not the time a
  // video frame callback is given, which stays the browser's own. Code that measures one against
  // the other (the video tile's stall check) would see the two clocks drift apart and call a
  // playing stream stopped, so the callback is given the fake clock's time too.
  await context.addInitScript(() => {
    const request = HTMLVideoElement.prototype.requestVideoFrameCallback;
    if (!request) return;
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
      return request.call(this, (_, metadata) => callback(performance.now(), metadata));
    };
  });
  await context.clock.install();
  const page = await context.newPage();
  page.on('pageerror', (error) => log(`  page error: ${error.message}`));
  const animations = [];

  // Frames as PNG with the box of what each draws: of the area, cut to its part, or for a script
  // of a clip around the part, drawn only in the part and the overlays open at that frame, with
  // the cursor on top unless the script drives hidden controls.
  const animate = async (topic, example, selector, trim) => {
    const read = examplesOf.get(`${topic.id}/${example.id}`);
    const scripted = Boolean(read.play || read.hide);
    const fps = read.animation?.fps ?? options.animation.fps;
    const step = Math.round(1000 / fps);
    const timeline = playTimeline(read.play ?? []);
    const seconds = read.animation?.seconds;
    const ms = Math.max(
      seconds ? seconds * 1000 : scripted ? 0 : options.animation.ms,
      scripted ? timeline.total : 0,
    );
    const count = Math.max(1, Math.round(ms / step));

    const area = page.locator(selector).first();
    if (scripted) await area.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    else await area.scrollIntoViewIfNeeded();
    await settle(page, options.settleMs);
    if (read.hide) await page.evaluate(hideInPage, { selector, hide: read.hide });
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + step);
    const { crop, shape } = await areaFrame(page, area, selector, trim);
    // A script's frames are the whole viewport, each drawn only in the example's part and the
    // overlays open at that moment, both measured again every frame (a section that opens grows
    // the part, a tooltip may open past it); the frames are cut to their union at the end.
    const clip = { x: 0, y: 0, width: options.viewport.width, height: options.viewport.height };
    const points = [];
    let from = null;
    const done = new Set();
    const frames = [];
    for (let i = 0; i < count; i++) {
      const t = i * step;
      let shot;
      let cursor = null;
      let shapes = [shape];
      let cut = crop;
      if (scripted) {
        // Each step's target is found as its move starts, so it follows what earlier steps moved.
        for (const [index, entry] of timeline.steps.entries()) {
          if (entry.action === 'wait' || points[index] !== undefined || t < entry.start) continue;
          points[index] = await targetPoint(area, entry, log);
          from ??= points[index] && { x: points[index].x + 40, y: points[index].y + 56 };
        }
        const at = from ? cursorAt(timeline, points, from, t) : null;
        if (at && !read.hide) await page.mouse.move(at.x, at.y);
        for (const [index, entry] of timeline.steps.entries()) {
          if (entry.action === 'wait' || done.has(index) || t < entry.arrive) continue;
          done.add(index);
          const point = points[index];
          if (!point) continue;
          if (entry.action === 'click') await page.mouse.click(point.x, point.y);
          else await page.mouse.move(point.x, point.y);
        }
        const framed = await page.evaluate(framingInPage, { selector, trim });
        shapes = [trimToContent(framed.area, framed.content, framed.inset), ...framed.surfaces];
        cut = null;
        cursor = at && !read.hide ? at : null;
        shot = await page.screenshot({ clip });
      } else {
        shot = await area.screenshot();
      }
      const frame = await encoder.evaluate(encodeInPage, {
        png: shot.toString('base64'),
        crop: cut,
        shapes,
        dpr: options.dpr,
        type: 'image/png',
        cursor,
      });
      frames.push({ png: Buffer.from(frame.png, 'base64'), box: frame.box });
      await page.clock.runFor(step);
      await page.evaluate(stepAnimationsInPage, step);
    }
    await page.clock.resume();
    // Every frame cut to the box around what any of them draws.
    const boxes = frames.map((frame) => frame.box).filter(Boolean);
    const whole = boxes.length ? union(boxes) : null;
    const pngs = await Promise.all(
      frames.map(({ png }) =>
        whole
          ? sharp(png)
              .extract({ left: whole.x, top: whole.y, width: whole.width, height: whole.height })
              .png()
              .toBuffer()
          : png,
      ),
    );
    const bytes = await sharp(pngs, { join: { animated: true } })
      .webp(animationEncoding(read.animation, step, pngs.length))
      .toBuffer();
    const path = picturePath(topic.id, example.id, scheme, true);
    await mkdir(join(options.out, topic.id), { recursive: true });
    await writeFile(join(options.out, path), bytes);
    animations.push({ path, bytes: bytes.length, animated: true });
    return scripted;
  };

  for (const topic of topics) {
    const wanted = (example) => {
      const read = examplesOf.get(`${topic.id}/${example.id}`);
      return read?.animated && (!options.gallery || read.gallery);
    };
    await page.goto(`${url}${topic.path}`);
    await page.locator('app-example-card article').first().waitFor();
    const examples = (await page.evaluate(examplesInPage)).filter(wanted);
    for (const example of examples.filter((e) => e.live)) {
      const selector = `app-example-card article:has(h3#example-${example.id}) .live`;
      // A script leaves its example changed, so the next one starts on a fresh page.
      if (await animate(topic, example, selector, true)) {
        await page.goto(`${url}${topic.path}`);
        await page.locator('app-example-card article').first().waitFor();
      }
    }
    for (const example of examples.filter((e) => e.page)) {
      await page.goto(`${url}${example.page}`);
      await animate(topic, example, 'main.content', false);
    }
    if (examples.length) log(`  ${scheme} ${topic.id}: ${examples.length} animated`);
  }
  await context.close();
  return animations;
}

/** Each example as docs:emit reads it (its `capture` and `gallery`), by `<topic>/<example>`. */
async function readExamples() {
  const { extractExamples } = await import('./docs-emit.mjs');
  const examplesOf = new Map();
  for (const { topic, examples } of extractExamples(ROOT).topics) {
    for (const example of examples) examplesOf.set(`${topic}/${example.id}`, example);
  }
  return examplesOf;
}

/**
 * Chrome's flags for the capture: autoplay without a gesture (the video tiles), and a fake camera
 * and a fake microphone that plays `voice`, so push-to-talk records and the camera dialog shows
 * Chrome's test pattern.
 */
export function browserArgs(voice) {
  return ['--autoplay-policy=no-user-gesture-required', ...fakeMediaFlags(voice)];
}

/** The whole run: serve, capture both schemes, then report the budget and stale pictures. */
export async function capture(options, log = console.log) {
  const [{ GROUPS }, { placedTopics }, { chromium }] = await Promise.all([
    import(pathToFileURL(join(ROOT, 'projects/showcase/src/app/docs/topics.ts')).href),
    import(pathToFileURL(join(ROOT, 'projects/showcase/src/app/docs/docs-routes.ts')).href),
    import('playwright'),
  ]);
  const examplesOf = await readExamples();
  const topicsWith = (has) =>
    new Set([...examplesOf].filter(([, e]) => has(e)).map(([key]) => key.split('/')[0]));
  const picked = topicsWith((e) => e.gallery);
  const moving = topicsWith((e) => e.animated && (!options.gallery || e.gallery));
  const topics = topicsToCapture(GROUPS, placedTopics, options.topics).filter(
    ({ id }) => !options.gallery || picked.has(id),
  );
  const dist = resolve(ROOT, options.dist);
  if (!(await stat(join(dist, 'index.html')).catch(() => null))) {
    throw new Error(`no built showcase in ${options.dist}: run npm run build:showcase first`);
  }
  const out = resolve(ROOT, options.out);
  const server = await serve(dist);
  const browser = await chromium.launch({
    channel: options.channel,
    args: browserArgs(await writeFakeVoice()),
  });
  try {
    const encoder = await browser.newPage();
    log(`Capturing ${topics.length} topics from ${server.url}`);
    const pictures = [];
    for (const scheme of SCHEMES) {
      const run = { scheme, url: server.url, topics, examplesOf, encoder, log };
      run.options = { ...options, out };
      if (options.only !== 'animations') pictures.push(...(await captureScheme(browser, run)));
      if (options.only !== 'stills') {
        run.topics = topics.filter(({ id }) => moving.has(id));
        pictures.push(...(await animateScheme(browser, run)));
      }
    }
    const total = pictures.reduce((sum, { bytes }) => sum + bytes, 0);
    const animated = pictures.filter((picture) => picture.animated).length;
    log(
      `Wrote ${pictures.length - animated} pictures and ${animated} animations, ` +
        `${Math.round(total / 1024)} kB, to ${options.out}`,
    );
    for (const warning of budgetWarnings(pictures, options.budget)) log(`warning: ${warning}`);
    // Only a whole run knows every picture; a part of one would call the rest stale.
    if (!options.topics && !options.gallery && options.only === 'all') {
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

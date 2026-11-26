// The chat parts' frame budget: every text motion, glow and picture motion, and every listening
// and speaking motion, on the bench's chat page (`/#/chat`), at 50 pieces a second, with Chrome's
// CPU at full speed and slowed 4× (CDP's `Emulation.setCPUThrottlingRate`). A run passes when
// every phase it has is smooth, the bench's tier: p95 within 1.25 refresh intervals and at most
// 5 % dropped; a listening run's recording must also decode to about its 3 s. Chrome gets a fake
// camera and a fake microphone playing a fake voice (`tools/fake-voice.mjs`).
//
// It builds nothing: run `npm run bench:build` first. It serves `dist/bench/browser`, opens the
// installed Google Chrome headed (headless Chrome rasterizes in software and paces frames its own
// way, so its numbers say nothing of a person's), gives each run a page of its own, and writes the
// results as JSON to `--out` and as a Markdown table beside it (`.md`).
//
//   node projects/bench/harness/chat-budget.mjs --out <file.json> [--only <name>]
//     [--browser-flags "<flags>"]
//
// `--browser-flags` are extra flags for Chrome (`--ozone-platform=wayland` on a headless sway).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fakeMediaFlags, writeFakeVoice } from '../../../tools/fake-voice.mjs';
import { parseBrowserFlags } from './browser-flags.mjs';
import { openBrowser } from './browser.mjs';
import { serveDist } from './serve.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DIST = resolve(REPO, 'dist/bench/browser');

const TEXT_MOTIONS = [
  'plain',
  'focus',
  'decrypt',
  'reverse-explosion',
  'token-flash',
  'drop-in',
  'word-cloud',
];
const GLOWS = ['comet', 'ring', 'aurora', 'sheen'];
const PICTURE_MOTIONS = [
  'coming-into-focus',
  'beam-and-patches',
  'viewfinder',
  'patches-into-model',
];
const LISTENING_MOTIONS = ['radial', 'in-message-box'];
const SPEAKING_MOTIONS = ['sentence', 'equalizer', 'word-by-word', 'waveform'];
const THROTTLES = [1, 4];
/** A listening run records this long; its recording decodes within `RECORDED_SLACK_MS` of it. */
const LISTEN_MS = 3000;
const RECORDED_SLACK_MS = 300;
/** The fake voice's length: longer than a recording, so it never runs out mid-run. */
const VOICE_SECONDS = 6;
const RATE = 50;
/** A picture's reading waits this long, so its phase holds enough frames to measure. */
const PICTURE_WAIT_MS = 3000;
/** The longest a run may take: the warm-up, a 3 s wait and 500 pieces at 50 a second, slowed. */
const RUN_TIMEOUT_MS = 90_000;

/** Every run of the budget: a name, the page's query and the CPU throttle. */
export function chatMatrix() {
  const runs = [
    ...TEXT_MOTIONS.map((text) => ({
      name: `text ${text}`,
      query: { text, picture: 'none', glow: 'comet', rate: RATE },
    })),
    ...GLOWS.map((glow) => ({
      name: `glow ${glow}`,
      query: { text: 'plain', picture: 'none', glow, rate: RATE },
    })),
    ...PICTURE_MOTIONS.map((picture) => ({
      name: `picture ${picture}`,
      query: { text: 'plain', picture, glow: 'comet', rate: RATE, wait: PICTURE_WAIT_MS },
    })),
    {
      name: 'code reply',
      query: { text: 'plain', picture: 'none', glow: 'comet', rate: RATE, reply: 'code' },
    },
    ...LISTENING_MOTIONS.map((listen) => ({
      name: `listen ${listen}`,
      query: { text: 'plain', picture: 'none', glow: 'comet', rate: RATE, listen },
    })),
    ...SPEAKING_MOTIONS.map((speak) => ({
      name: `speak ${speak}`,
      query: { text: 'plain', picture: 'none', glow: 'comet', rate: RATE, speak },
    })),
    {
      name: 'speak equalizer, text decrypt',
      query: { text: 'decrypt', picture: 'none', glow: 'comet', rate: RATE, speak: 'equalizer' },
    },
  ];
  return THROTTLES.flatMap((throttle) => runs.map((run) => ({ ...run, throttle })));
}

/** The page's address for a run's query, measuring once. */
export function runUrl(base, query) {
  const params = new URLSearchParams({ ...query, measure: '1' });
  return `${base}#/chat?${params}`;
}

/** The phases a run may have, in the order they come. */
const PHASES = ['listening', 'heard', 'waiting', 'streaming', 'speaking'];

/** Chrome's flags for the budget: the extra ones, autoplay, and the fake devices on `voice`. */
export function chatBrowserFlags(extra, voice) {
  return [...extra, '--autoplay-policy=no-user-gesture-required', ...fakeMediaFlags(voice)];
}

/**
 * Whether a run held the budget: every phase it has smooth, and a listening run's recording real
 * audio that decodes to about its 3 s.
 */
export function passes(result) {
  const smooth = PHASES.every((name) => !result[name] || result[name].tier === 'smooth');
  if (!smooth) return false;
  if (!result.listening) return true;
  const recorded = result.recorded;
  return (
    !!recorded &&
    recorded.bytes > 0 &&
    recorded.type.startsWith('audio/') &&
    Math.abs(recorded.decodedMs - LISTEN_MS) <= RECORDED_SLACK_MS
  );
}

/** The results as a Markdown table, a row a run, a cell a phase. */
export function chatTable(rows) {
  const ms = (value) => value.toFixed(1);
  const phase = (result) =>
    result
      ? `${ms(result.frames.fps)} fps, p95 ${ms(result.frames.p95)}, ` +
        `${ms(result.frames.droppedPct)} %, script p95 ${ms(result.script.p95)}, ${result.tier}`
      : '–';
  const head = [
    'Run',
    'CPU',
    'Hz',
    'Listening',
    'Heard',
    'Waiting',
    'Streaming',
    'long frames',
    'largest ms',
    'Speaking',
    'Recording ms',
    'Verdict',
  ];
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [
    line(head),
    line(head.map(() => '---')),
    ...rows.map(({ name, throttle, result }) =>
      line([
        name,
        `${throttle}×`,
        String(result.hz),
        phase(result.listening),
        phase(result.heard),
        phase(result.waiting),
        phase(result.streaming),
        String(result.streaming.loafs.frames),
        ms(result.streaming.loafs.largestMs),
        phase(result.speaking),
        result.recorded ? String(Math.round(result.recorded.decodedMs)) : '–',
        passes(result) ? 'pass' : 'fail',
      ]),
    ),
  ].join('\n');
}

/** Runs the matrix (or the runs whose name holds `only`) and writes the results. */
async function main(argv) {
  const out = valueOf(argv, '--out');
  if (!out) {
    throw new Error(
      'Usage: chat-budget.mjs --out <file.json> [--only <name>] [--browser-flags "<flags>"]',
    );
  }
  const only = valueOf(argv, '--only');
  const browserFlags = parseBrowserFlags(valueOf(argv, '--browser-flags'));
  const matrix = chatMatrix().filter((run) => !only || run.name.includes(only));
  const server = await serveDist(DIST);
  const voice = await writeFakeVoice(VOICE_SECONDS);
  const browser = await openBrowser({
    target: { kind: 'local' },
    headless: false,
    viewport: { w: 1280, h: 800 },
    dpr: 'native',
    channel: 'chrome',
    browserFlags: chatBrowserFlags(browserFlags, voice),
  });
  const rows = [];
  try {
    for (const run of matrix) {
      const session = await browser.session();
      try {
        const cdp = await session.context.newCDPSession(session.page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: run.throttle });
        await session.page.goto(runUrl(server.url, run.query));
        const handle = await session.page.waitForFunction(() => window.benchChat, null, {
          timeout: RUN_TIMEOUT_MS,
        });
        const result = await handle.jsonValue();
        rows.push({ ...run, result });
        console.log(`${run.name} at ${run.throttle}×: ${passes(result) ? 'pass' : 'fail'}`);
      } finally {
        await session.release();
      }
    }
    const facts = await browser.facts();
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(
      resolve(out),
      `${JSON.stringify({ browser: facts.version, gpu: facts.gpu.featureStatus, mode: browser.mode, runs: rows }, null, 2)}\n`,
    );
    writeFileSync(resolve(out).replace(/\.json$/, '') + '.md', `${chatTable(rows)}\n`);
  } finally {
    await browser.close();
    await server.close();
  }
}

function valueOf(argv, name) {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

// The harness's command line (design 4.1): parsed and judged before anything is launched, so a
// campaign of an hour does not start with an option it cannot honour. Pure.
import { parseArgs as parseNodeArgs } from 'node:util';

export class UsageError extends Error {}

export const USAGE = `Usage: npm run bench:run -- --machine <label> [options]

What to run
  --machine <label>          the machine profile the run is filed under (required)
  --ladders A,B,C,D,E        the load ladders to climb (default A); E runs on the kit only
  --renderers kit,vflow,none the renderers to measure (default kit,vflow)
  --repeats 3                runs per ladder and renderer, the renderer order alternating
  --steps N                  climb only each ladder's first N levels (smoke runs)
  --seed 1                   seeds the diagram and its messages
  --refine                   bisect the knee after each climb (two steps)
  --input=page|cdp           who plays the gestures: the page, or this harness through the
                             browser's input pipeline (the cross-check; not for 'none')

Where the page comes from
  --url http://<host>:4300/  a bench somebody serves (the board's own server, say); without it
                             the harness serves --dist itself
  --dist projects/...        the built bench (npm run bench:build), also where source maps are read

Which browser
  --target local             Playwright's Chromium on this machine (default)
  --target cdp:<endpoint>    a Chromium already running with --remote-debugging-port, e.g. through
                             your own tunnel: http://127.0.0.1:9222
  --target remote            start a Chromium on the board over --ssh, drive it through a tunnel,
                             stop it and delete its files afterwards
  --headless                 headless Chromium (local, or remote without --remote-display); a
                             function test only: headless paces frames differently
  --viewport 1920x1080|native  the page's size (default 1920x1080; native: the window's own)
  --dpr 1|native             the laptop profile: device pixel ratio 1, or the screen's own
  --ssh user@board           read the board's load, temperatures and CPU frequencies before and
                             after each run, and start the browser there for --target remote
  --cooldown <s>             idle between runs (default 20 with --ssh or a CDP target, else 0)

Remote browser (--target remote)
  --remote-serve-port 4390   where the board's browser reaches this laptop's server (reverse tunnel)
  --remote-chromium chromium the browser's name or path on the board
  --remote-display :0        run headed on that X display (kiosk) instead of headless; the page
                             then has the display's own size, whatever --viewport says
  --remote-xauthority <path> the X authority file of that display on the board (absolute path;
                             default: the board user's $HOME/.Xauthority)
  (the browser takes a free debugging port itself and the harness reads which)

Output
  --out projects/bench/results   run files, screenshots and traces (gitignored)
  --trace                    one extra run per renderer and ladder, traced: the display's draws give
                             the presented rate that decides the tier (all steps, the board default)
  --trace-steps N|all        trace only the first N levels (default all, as far as --steps goes)
  --no-screenshots           no screenshot of the last step of each run
  --allow-unfair             go on, with a warning in every result, when the fairness check
                             between the kit and vflow fails (otherwise the run stops)`;

const LADDERS = ['A', 'B', 'C', 'D', 'E'];
const RENDERERS = ['kit', 'vflow', 'none'];
const INPUTS = ['page', 'cdp'];
const DEV_PORTS = [4200, 9900];

const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  url: { type: 'string' },
  dist: { type: 'string' },
  target: { type: 'string' },
  machine: { type: 'string' },
  ladders: { type: 'string' },
  renderers: { type: 'string' },
  repeats: { type: 'string' },
  steps: { type: 'string' },
  seed: { type: 'string' },
  refine: { type: 'boolean' },
  trace: { type: 'boolean' },
  'trace-steps': { type: 'string' },
  input: { type: 'string' },
  ssh: { type: 'string' },
  out: { type: 'string' },
  headless: { type: 'boolean' },
  viewport: { type: 'string' },
  dpr: { type: 'string' },
  cooldown: { type: 'string' },
  'allow-unfair': { type: 'boolean' },
  'no-screenshots': { type: 'boolean' },
  'remote-serve-port': { type: 'string' },
  'remote-chromium': { type: 'string' },
  'remote-display': { type: 'string' },
  'remote-xauthority': { type: 'string' },
};

function whole(value, name, least, fallback) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (value.trim() === '' || !Number.isInteger(number) || number < least) {
    throw new UsageError(`--${name} is a whole number from ${least}, not "${value}"`);
  }
  return number;
}

/** How many levels a traced run climbs: a count, or every one (undefined: as far as --steps). */
function traceSteps(value) {
  return value === 'all' ? undefined : whole(value, 'trace-steps', 1, undefined);
}

function port(value, name, fallback) {
  const number = whole(value, name, 1024, fallback);
  if (number > 65535 || DEV_PORTS.includes(number)) {
    throw new UsageError(
      `--${name}: ${number} is not a port this harness may use ` +
        '(4200 and 9900 are for the dev servers)',
    );
  }
  return number;
}

function list(value, name, allowed, fallback, what, upper = false) {
  if (value === undefined) return fallback;
  const items = value.split(',').map((item) => (upper ? item.trim().toUpperCase() : item.trim()));
  for (const item of items) {
    if (item === 'vflow-virt') {
      throw new UsageError('renderer vflow-virt is not built yet: it is planned with the runs');
    }
    if (!allowed.includes(item)) {
      throw new UsageError(`${what} is one of ${allowed.join(', ')}, not "${item}"`);
    }
  }
  return items;
}

function target(value) {
  if (value === undefined || value === 'local') return { kind: 'local' };
  if (value === 'remote') return { kind: 'remote' };
  if (value.startsWith('cdp:') && value.length > 'cdp:'.length) {
    return { kind: 'cdp', endpoint: value.slice('cdp:'.length) };
  }
  throw new UsageError(`--target is local, remote or cdp:<endpoint>, not "${value}"`);
}

/** The board's shell reads it, so: an absolute path of plain characters, or nothing. */
function xauthority(value) {
  if (value === undefined) return undefined;
  if (!/^\/[\w./+-]+$/.test(value)) {
    throw new UsageError(`--remote-xauthority is an absolute path on the board, not "${value}"`);
  }
  return value;
}

function viewport(value) {
  if (value === undefined) return { w: 1920, h: 1080 };
  if (value === 'native') return 'native';
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(value);
  if (!match) throw new UsageError(`--viewport is WxH (1920x1080) or native, not "${value}"`);
  return { w: Number(match[1]), h: Number(match[2]) };
}

/** The options as the harness uses them; throws `UsageError` saying which one is wrong. */
export function parseArgs(argv) {
  let parsed;
  try {
    parsed = parseNodeArgs({ args: argv, options: OPTIONS, allowPositionals: false });
  } catch (error) {
    throw new UsageError(error.message);
  }
  const v = parsed.values;
  if (v.help) return { help: true };
  if (!v.machine) throw new UsageError('--machine <label> is required: results are filed under it');

  const renderers = list(v.renderers, 'renderers', RENDERERS, ['kit', 'vflow'], 'renderer');
  const input = v.input ?? 'page';
  if (!INPUTS.includes(input))
    throw new UsageError(`--input is one of ${INPUTS.join(', ')}, not "${input}"`);
  if (input === 'cdp' && renderers.includes('none')) {
    throw new UsageError('--input=cdp needs a renderer with a zoom box: not the none host');
  }
  const dpr = v.dpr ?? '1';
  if (dpr !== '1' && dpr !== 'native') throw new UsageError(`--dpr is 1 or native, not "${dpr}"`);

  const where = target(v.target);
  // A host that could pass for an ssh option would run it: `-oProxyCommand=...`.
  if (v.ssh !== undefined && !/^(?:[A-Za-z0-9_][\w.-]*@)?[A-Za-z0-9][\w.-]*$/.test(v.ssh)) {
    throw new UsageError(`--ssh is user@host, not "${v.ssh}"`);
  }
  if (where.kind === 'remote' && v.ssh === undefined) {
    throw new UsageError('--target remote starts a browser on the board over --ssh user@host');
  }
  const onBoard = v.ssh !== undefined || where.kind !== 'local';
  return {
    help: false,
    machine: v.machine,
    url: v.url,
    dist: v.dist ?? 'dist/bench/browser',
    target: where,
    ladders: list(v.ladders, 'ladders', LADDERS, ['A'], 'ladder', true),
    renderers,
    repeats: whole(v.repeats, 'repeats', 1, 3),
    steps: whole(v.steps, 'steps', 1, undefined),
    seed: whole(v.seed, 'seed', 0, 1),
    refine: v.refine ?? false,
    trace: v.trace ?? false,
    traceSteps: traceSteps(v['trace-steps']),
    input,
    ssh: v.ssh,
    out: v.out ?? 'projects/bench/results',
    headless: v.headless ?? false,
    viewport: viewport(v.viewport),
    dpr,
    cooldownMs: whole(v.cooldown, 'cooldown', 0, onBoard ? 20 : 0) * 1000,
    allowUnfair: v['allow-unfair'] ?? false,
    screenshots: !v['no-screenshots'],
    remote: {
      servePort: port(v['remote-serve-port'], 'remote-serve-port', 4390),
      chromium: v['remote-chromium'] ?? 'chromium',
      display: v['remote-display'],
      xauthority: xauthority(v['remote-xauthority']),
    },
  };
}

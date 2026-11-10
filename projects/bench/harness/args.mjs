// The harness's command line (design 4.1): parsed and judged before anything is launched, so a
// campaign of an hour does not start with an option it cannot honor. Pure.
import { parseArgs as parseNodeArgs } from 'node:util';
import { parseBrowserFlags } from './browser-flags.mjs';

export class UsageError extends Error {}

export const USAGE = `Usage: npm run bench:run -- --machine <label> [options]

What to run
  --machine <label>          the machine profile the run is filed under (required)
  --ladders A,B,C,D,E        the load ladders to climb (default A); E runs on the kit only
  --renderers kit,vflow,none the renderers to measure (default kit,vflow)
  --repeats 3                runs per ladder and renderer, the renderer order alternating
  --steps N                  climb only each ladder's first N levels (smoke runs); A and D start at
                             ×1/8, so their ×1 is the 4th level
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
  --browser-flags "<flags>"   extra Chromium flags for the browser this harness starts (local or
                             remote), a flag variant: "--disable-gpu", "--num-raster-threads=4";
                             --name or --name=value of plain characters, recorded in the result
  --dpr 1|native             the laptop profile: device pixel ratio 1, or the screen's own
  --ssh user@board           read the board's load, temperatures and CPU frequencies before and
                             after each run, and start the browser there for --target remote
  --cooldown <s>             idle between runs (default 20 with --ssh or a CDP target, else 0)

Remote browser (--target remote)
  --remote-serve-port 4390   where the board's browser reaches this laptop's server (reverse tunnel)
  --remote-chromium chromium the browser's name or path on the board
  --remote-display :0        run headed on that X display (kiosk) instead of headless; the page
                             then has the display's own size, whatever --viewport says
  --remote-display bare      run headed on a bare X server the harness starts for the run, with
                             the browser alone and no desktop: it stops LightDM (never disables
                             it), starts Xorg with a cookie of its own, and on the way out stops
                             Xorg and starts LightDM again, saying whether the display is
                             restored. A guard on the board does that teardown itself if this
                             laptop goes quiet (killed, link lost) for 20 s. Needs --target
                             remote; --remote-xauthority is refused
  --remote-mode 1920x1080    the bare display's mode, set at 60 Hz on its connected output before
                             the browser starts (default 1920x1080); a mode the output does not
                             offer at 60 Hz stops the campaign before it measures anything
  --remote-xauthority <path> the X authority file of that display on the board (absolute path;
                             default: the board user's $HOME/.Xauthority)
  (the browser takes a free debugging port itself and the harness reads which)

Where the board's page is served from (default: this laptop, through a reverse tunnel)
  --serve board[:<bind>]     copy the built bench to the board and serve it there with a static
                             server (python3), so no tunnel latency enters a run; bind 127.0.0.1
                             unless given, else one of the board's own addresses (never
                             0.0.0.0). --serve board:10.42.0.68 binds the USB link, so a
                             laptop browser (--target local) can load the board's page

Output
  --out projects/bench/results   run files, screenshots and traces (gitignored)
  --trace                    one extra run per renderer and ladder, traced: the display's draws give
                             the presented rate that decides the tier (all steps, the board default)
  --trace-steps N|all        trace only the first N levels (default all, as far as --steps goes);
                             counted as --steps is: ×1 is the 4th level of A and D
  --trace-categories viz,cc  the traced runs' categories (default viz, the display's draws, which
                             the presented rate needs, so the list must hold it); more categories
                             make a trace to read thread by thread, at a cost on the board
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
  'trace-categories': { type: 'string' },
  input: { type: 'string' },
  ssh: { type: 'string' },
  out: { type: 'string' },
  headless: { type: 'boolean' },
  viewport: { type: 'string' },
  dpr: { type: 'string' },
  'browser-flags': { type: 'string' },
  cooldown: { type: 'string' },
  'allow-unfair': { type: 'boolean' },
  'no-screenshots': { type: 'boolean' },
  'remote-serve-port': { type: 'string' },
  'remote-chromium': { type: 'string' },
  'remote-display': { type: 'string' },
  'remote-xauthority': { type: 'string' },
  'remote-mode': { type: 'string' },
  serve: { type: 'string' },
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

/**
 * The categories a traced run records: `viz` alone unless told, and never without it, since the
 * presented rate that decides a tier is read from its display draws. Names as Chromium spells
 * them (`disabled-by-default-devtools.timeline`); a category Chromium does not know records
 * nothing, it does not fail.
 */
function traceCategories(value, trace) {
  if (value === undefined) return ['viz'];
  if (!trace)
    throw new UsageError('--trace-categories sets what a traced run records: needs --trace');
  const items = value.split(',').map((item) => item.trim());
  for (const item of items) {
    if (!/^[\w.*-]+$/.test(item)) {
      throw new UsageError(`--trace-categories is a comma-separated list of names, not "${value}"`);
    }
  }
  if (!items.includes('viz')) {
    throw new UsageError(
      '--trace-categories needs viz: the presented rate is read from its display draws',
    );
  }
  return items;
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

const LOOPBACK = /^127\./;

/**
 * `board` or `board:<ipv4>`: where the bench is served from, judged before any ssh (the board
 * checks that the address is one of its own when the server starts).
 */
function serve(value) {
  if (value === undefined) return undefined;
  const match = /^board(?::(\d{1,3}(?:\.\d{1,3}){3}))?$/.exec(value);
  const bind = match?.[1] ?? (match ? '127.0.0.1' : undefined);
  if (!match || bind.split('.').some((part) => Number(part) > 255)) {
    throw new UsageError(`--serve is board or board:<ipv4 address to bind>, not "${value}"`);
  }
  // Every interface, the board's LAN included: the bench is for this laptop's link at most.
  if (/^0+\.0+\.0+\.0+$/.test(bind)) {
    throw new UsageError(
      `--serve board:${bind} would serve on every interface of the board: bind loopback or ` +
        'the address of the link to this laptop (board:10.42.0.68)',
    );
  }
  return { where: 'board', bind };
}

/** The bare display's mode, `WxH`; set at 60 Hz (the spec's 1080p/60 unless told otherwise). */
function remoteMode(value, bare) {
  if (value === undefined) return bare ? { w: 1920, h: 1080 } : undefined;
  if (!bare) {
    throw new UsageError('--remote-mode sets the bare display: it needs --remote-display bare');
  }
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(value);
  if (!match) throw new UsageError(`--remote-mode is WxH (1920x1080), not "${value}"`);
  return { w: Number(match[1]), h: Number(match[2]) };
}

function viewport(value) {
  if (value === undefined) return { w: 1920, h: 1080 };
  if (value === 'native') return 'native';
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(value);
  if (!match) throw new UsageError(`--viewport is WxH (1920x1080) or native, not "${value}"`);
  return { w: Number(match[1]), h: Number(match[2]) };
}

/**
 * `--browser-flags "--disable-gpu"` as the usage shows it: node's parser takes a value that
 * starts with a dash for another option and refuses it, so the pair is joined into the
 * `--browser-flags=<flags>` it does take.
 */
function joinBrowserFlags(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--browser-flags' && i + 1 < argv.length) {
      out.push(`--browser-flags=${argv[i + 1]}`);
      i += 1;
    } else out.push(argv[i]);
  }
  return out;
}

function browserFlags(value) {
  try {
    return parseBrowserFlags(value);
  } catch (error) {
    throw new UsageError(error.message);
  }
}

/** The options as the harness uses them; throws `UsageError` saying which one is wrong. */
export function parseArgs(argv) {
  let parsed;
  try {
    parsed = parseNodeArgs({
      args: joinBrowserFlags(argv),
      options: OPTIONS,
      allowPositionals: false,
    });
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
  const bare = v['remote-display'] === 'bare';
  if (bare && where.kind !== 'remote') {
    throw new UsageError(
      '--remote-display bare starts an X server on the board: needs --target remote',
    );
  }
  if (bare && v.headless) {
    throw new UsageError('--remote-display bare is a headed run: it cannot be --headless');
  }
  if (bare && v['remote-xauthority'] !== undefined) {
    throw new UsageError(
      '--remote-xauthority is not allowed with --remote-display bare: the harness makes the cookie',
    );
  }
  const serving = serve(v.serve);
  if (serving) {
    if (v.ssh === undefined)
      throw new UsageError('--serve board copies the bench over --ssh user@host');
    if (v.url !== undefined) {
      throw new UsageError('--serve board makes the page address itself: not with --url');
    }
    if (where.kind === 'cdp') {
      throw new UsageError('--serve board is for --target local or remote, not a CDP target');
    }
    if (where.kind === 'local' && LOOPBACK.test(serving.bind)) {
      throw new UsageError(
        '--serve board for a browser here needs a bind address this laptop can reach ' +
          '(board:10.42.0.68), not a loopback one',
      );
    }
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
    traceCategories: traceCategories(v['trace-categories'], v.trace ?? false),
    input,
    ssh: v.ssh,
    serve: serving,
    out: v.out ?? 'projects/bench/results',
    headless: v.headless ?? false,
    viewport: viewport(v.viewport),
    dpr,
    browserFlags: browserFlags(v['browser-flags']),
    cooldownMs: whole(v.cooldown, 'cooldown', 0, onBoard ? 20 : 0) * 1000,
    allowUnfair: v['allow-unfair'] ?? false,
    screenshots: !v['no-screenshots'],
    remote: {
      servePort: port(v['remote-serve-port'], 'remote-serve-port', 4390),
      chromium: v['remote-chromium'] ?? 'chromium',
      display: v['remote-display'],
      xauthority: xauthority(v['remote-xauthority']),
      mode: remoteMode(v['remote-mode'], bare),
    },
  };
}

// `npm run bench:run`: the harness that drives the bench in a browser and collects its results
// (AGENTS.md "The rendering bench", design 4.1). `args.mjs` has the options; `campaign.mjs` is the
// flow. Whatever it starts (a server, a browser on the board) is stopped on the way out, on a
// signal too.
import { parseArgs, USAGE, UsageError } from './args.mjs';
import { runCampaign } from './campaign.mjs';
import { runCleanups } from './cleanup.mjs';

const log = (line) => console.error(`[bench ${new Date().toISOString().slice(11, 19)}] ${line}`);

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof UsageError)) throw error;
  console.error(`${error.message}\n\n${USAGE}`);
  process.exit(2);
}
if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

const cleanups = [];
let cleaned = null;
let cleanupFailures = 0;
const cleanup = () => {
  // Last started, first stopped: the browser before the board's tunnel and the server.
  cleaned ??= runCleanups(cleanups, log).then((failed) => (cleanupFailures += failed));
  return cleaned;
};
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`${signal}: stopping what was started`);
    cleanup().finally(() => process.exit(130));
  });
}

let code = 0;
try {
  const outcome = await runCampaign(options, { log, cleanups });
  if (outcome.unfair) code = 3;
  else {
    log(`wrote ${outcome.file}`);
    if (outcome.failed > 0) {
      log(`${outcome.failed} run(s) failed; they are recorded in the file`);
      code = 1;
    }
  }
} catch (error) {
  log(`failed: ${error.stack ?? error.message}`);
  code = 1;
} finally {
  await cleanup();
}
// A board left unclean is a failed run, whatever the measurements said.
if (cleanupFailures > 0 && code === 0) code = 1;
process.exit(code);

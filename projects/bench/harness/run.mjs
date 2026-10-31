// `npm run bench:run`: the harness that drives the bench in a browser and collects its results
// (AGENTS.md "The rendering bench"). Until it is built, it only says how it will be called.
const USAGE = `Usage: npm run bench:run -- --url http://<host>:4300/
  --target local|cdp:http://127.0.0.1:9222   launch a browser here, or drive one over CDP
  --machine <label>                          the machine profile the run is filed under
  --ladders A,B,C,D,E                        the load ladders to climb
  --renderers kit,vflow,vflow-virt,none      the renderers to measure
  --repeats 3                                runs per ladder and renderer
  [--refine] [--trace] [--input=page|cdp] [--ssh user@board] [--out projects/bench/results]`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
} else {
  console.error(`The bench harness is not built yet.\n\n${USAGE}`);
  process.exit(1);
}

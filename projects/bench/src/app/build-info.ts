/**
 * The commit this bundle was built from, for the harness to compare with its checkout. `npm run
 * bench:build` passes it to the Angular build as `--define BENCH_GIT_SHA="<sha>[-dirty]"`
 * (`harness/bench-build.mjs`); a build made any other way (`ng serve`, `ng build`) has none and
 * says `unknown`, which the harness warns of.
 */
declare const BENCH_GIT_SHA: string | undefined;

export const BUILT_FROM: string = typeof BENCH_GIT_SHA === 'string' ? BENCH_GIT_SHA : 'unknown';

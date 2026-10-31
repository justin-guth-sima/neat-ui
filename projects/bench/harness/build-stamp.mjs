// Which commit a measured build was made from (design 4.2, `bench.gitSha`). The page cannot ask
// git, and a harness reading the checkout it runs in says nothing of a build made earlier, or
// served from elsewhere with `--url`. So `npm run bench:build` embeds the commit (marked dirty
// where the sources are not exactly it) in the bundle, the page reports it, and the harness
// compares it with the checkout and warns where they differ or the build is not stamped. Pure
// apart from the `git` it is given.

/** Untracked files count as the build's own where they sit under the bench or the kit. */
const SOURCE_DIRS = ['projects/bench/', 'projects/neat-ui/'];

/**
 * Whether `git status --porcelain --untracked-files=all` shows the sources changed: a tracked file
 * anywhere (a lockfile or a config changes a build too), or an untracked file under the bench's or
 * the kit's folders (a new source file is part of the build; a note beside the repo is not).
 */
export function isDirty(porcelain) {
  return porcelain
    .split('\n')
    .filter((line) => line.trim() !== '')
    .some((line) => {
      if (!line.startsWith('?? ')) return true;
      const path = line.slice(3).replace(/^"|"$/g, '');
      return SOURCE_DIRS.some((dir) => path.startsWith(dir));
    });
}

/** `<sha>`, `<sha>-dirty`, or `unknown` where `git(args)` (its output) cannot be had. */
export async function describeCheckout(git) {
  try {
    const sha = (await git(['rev-parse', 'HEAD'])).trim();
    if (!sha) return 'unknown';
    const status = await git(['status', '--porcelain', '--untracked-files=all']);
    return isDirty(status) ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

export const DEFINE_NAME = 'BENCH_GIT_SHA';

/** The arguments of `ng` that build the bench with `stamp` as the constant `BENCH_GIT_SHA`. */
export function buildArgs(stamp, extra) {
  if (!/^(?:[0-9a-f]{7,64}(?:-dirty)?|unknown)$/.test(stamp)) {
    throw new Error(`"${stamp}" is not a commit stamp`);
  }
  return ['build', 'bench', `--define=${DEFINE_NAME}="${stamp}"`, ...extra];
}

const short = (stamp) => (stamp.length > 12 ? `${stamp.slice(0, 12)}${stamp.slice(40)}` : stamp);

/**
 * The warnings the build's stamp (`built`, from the page) and the checkout's (`checkout`) call
 * for. `url`, where the harness did not serve the build itself, is the address it came from.
 */
export function verifyBuild({ built, checkout, url }) {
  const warnings = [];
  if (!built || built === 'unknown') {
    warnings.push(
      url
        ? `The build at ${url} (--url) is unverified: it carries no commit stamp, so nothing ` +
            'ties its numbers to a commit of this checkout. Serve a build made with ' +
            '`npm run bench:build`.'
        : 'The built bench carries no commit stamp (it was not made with `npm run bench:build`): ' +
            'nothing ties these numbers to a commit. Build it again with `npm run bench:build`.',
    );
    return warnings;
  }
  if (built.endsWith('-dirty')) {
    warnings.push(
      `The measured build was made from uncommitted changes (${short(built)}): ` +
        'it is not the commit’s.',
    );
  }
  if (checkout === 'unknown') {
    warnings.push(
      `The measured build is ${short(built)}, which cannot be checked: this checkout has no git.`,
    );
  } else if (built !== checkout) {
    const moved = built.replace(/-dirty$/, '') === checkout.replace(/-dirty$/, '');
    warnings.push(
      moved
        ? `The checkout has changed since the build (built from ${short(built)}, now ` +
            `${short(checkout)}): the measured build may not be these sources.`
        : `The measured build is from ${short(built)} but this checkout is ${short(checkout)}: ` +
            'the numbers are not of the code here.',
    );
  }
  return warnings;
}

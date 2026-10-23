// `npm run check:dist`: fails when dist/neat-ui would ship a broken package. ng-packagr builds
// green even when vendored helm code still imports through the `@neat-ui/helm` alias (it treats
// the alias as an external package, which no app can resolve), and `ng build neat-ui` alone leaves
// out the compiled stylesheet that styles/neat-ui.css imports. It also cannot tell that the video
// code leaked back into the primary entry point, which would put it in every page's bundle again.
// Run after `npm run build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/neat-ui', import.meta.url));
const ALIAS = '@neat-ui/helm';
/** The video tile's selector: present in the primary entry point only if video code leaked into it. */
const VIDEO_MARKER = 'neat-video-tile';
/** Packed tarballs are compressed; their contents are the files checked here. */
const SKIPPED = /\.tgz$/;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (!SKIPPED.test(entry.name)) yield path;
  }
}

/** Everything wrong with the package built in `dist`, one message per problem. */
export function findProblems(dist) {
  if (!existsSync(dist)) return [`${dist} does not exist; run \`npm run build\` first`];

  const problems = [];
  const compiledStylesheet = join(dist, 'styles', 'neat-ui.tailwind.css');
  if (!existsSync(compiledStylesheet)) {
    problems.push(`${compiledStylesheet} is missing; build with \`npm run build\`, not ng build`);
  }

  const primary = join(dist, 'fesm2022', 'sima-neat-ui.mjs');
  const video = join(dist, 'fesm2022', 'sima-neat-ui-video.mjs');
  if (!existsSync(primary)) {
    problems.push(`${primary} is missing`);
  } else if (readFileSync(primary, 'utf8').includes(VIDEO_MARKER)) {
    problems.push(
      `${primary} contains the video tile; video code belongs in @sima/neat-ui/video only`,
    );
  }
  if (!existsSync(video)) {
    problems.push(`${video} is missing; the @sima/neat-ui/video entry point was not built`);
  }

  for (const file of files(dist)) {
    if (readFileSync(file, 'utf8').includes(ALIAS)) problems.push(`${file} references ${ALIAS}`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = findProblems(DIST);
  if (problems.length) {
    console.error(`dist/neat-ui is not shippable:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(
    'dist/neat-ui: both entry points built, no video code in the primary, no helm alias imports, compiled stylesheet present.',
  );
}

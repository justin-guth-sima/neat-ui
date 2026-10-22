// `npm run check:dist`: fails when dist/neat-ui would ship a broken package. ng-packagr builds
// green even when vendored helm code still imports through the `@neat-ui/helm` alias (it treats
// the alias as an external package, which no app can resolve), and `ng build neat-ui` alone leaves
// out the compiled stylesheet that styles/neat-ui.css imports. Run after `npm run build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/neat-ui', import.meta.url));
const COMPILED_STYLESHEET = join(DIST, 'styles', 'neat-ui.tailwind.css');
const ALIAS = '@neat-ui/helm';
/** Packed tarballs are compressed; their contents are the files checked here. */
const SKIPPED = /\.tgz$/;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (!SKIPPED.test(entry.name)) yield path;
  }
}

const problems = [];
if (!existsSync(DIST)) {
  problems.push(`${DIST} does not exist; run \`npm run build\` first`);
} else {
  if (!existsSync(COMPILED_STYLESHEET)) {
    problems.push(`${COMPILED_STYLESHEET} is missing; build with \`npm run build\`, not ng build`);
  }
  for (const file of files(DIST)) {
    if (readFileSync(file, 'utf8').includes(ALIAS)) problems.push(`${file} references ${ALIAS}`);
  }
}

if (problems.length) {
  console.error(`dist/neat-ui is not shippable:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('dist/neat-ui: no helm alias imports, compiled stylesheet present.');

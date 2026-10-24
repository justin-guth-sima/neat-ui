// `npm run check:dist`: fails when dist/neat-ui would ship a broken package. ng-packagr builds
// green even when vendored helm code still imports through the `@neat-ui/helm` alias (it treats
// the alias as an external package, which no app can resolve), and `ng build neat-ui` alone leaves
// out the compiled stylesheet that styles/neat-ui.css imports. It also cannot tell that the code of
// a secondary entry point (video, switch, ...) leaked back into the primary, which would put it in
// every page's bundle again. Run after `npm run build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/neat-ui', import.meta.url));
const ALIAS = '@neat-ui/helm';
/**
 * The kit's secondary entry points (@sima/neat-ui/<name>) and every selector each declares. A
 * selector appears in the primary FESM only if that entry's code leaked into it, and listing all of
 * an entry's selectors catches a partial leak too. A new entry point is added here; the test
 * compares this table with the entry folders on disk, so one missing from it fails the test.
 */
export const SECONDARY_ENTRIES = {
  callout: ['neat-callout'],
  collapsible: ['neat-collapsible'],
  confirm: ['neat-confirm-dialog'],
  details: ['dl[neatDetails]'],
  dialog: ['neat-dialog-panel', 'neat-dialog-body', 'neat-dialog-actions'],
  'drop-zone': ['neat-drop-zone'],
  field: ['neat-field', 'neat-error-note'],
  'file-browser': ['neat-file-browser'],
  input: ['input[neatInput]'],
  'level-meter': ['neat-level-meter'],
  'line-list': ['ul[neatLineList]', 'li[neatLine]', '[neatLineEnd]'],
  'number-field': ['neat-number-field'],
  popover: ['neat-popover', 'ng-template[neatPopoverContent]', 'button[neatPopoverTrigger]'],
  progress: ['neat-progress'],
  segmented: ['neat-segmented'],
  select: ['neat-select'],
  'select-list': ['neat-select-list', 'ng-template[neatColumn]'],
  slider: ['neat-slider'],
  'status-chip': ['neat-status-chip', 'button[neatStatusChip]'],
  switch: ['button[neatSwitch]'],
  tabs: ['neat-tabs', 'neat-tab'],
  toast: ['neat-toast-host'],
  video: ['neat-video-tile', 'neat-tile-grid', 'neat-roi-editor', 'neat-roi-swatch'],
};
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

  const fesm = (name) => join(dist, 'fesm2022', `sima-neat-ui${name ? `-${name}` : ''}.mjs`);
  const primary = fesm('');
  if (!existsSync(primary)) {
    problems.push(`${primary} is missing`);
  } else {
    const source = readFileSync(primary, 'utf8');
    for (const [name, selectors] of Object.entries(SECONDARY_ENTRIES)) {
      for (const selector of selectors.filter((candidate) => source.includes(candidate))) {
        problems.push(
          `${primary} contains "${selector}"; that code belongs in @sima/neat-ui/${name} only`,
        );
      }
    }
  }
  for (const name of Object.keys(SECONDARY_ENTRIES)) {
    if (!existsSync(fesm(name))) {
      problems.push(
        `${fesm(name)} is missing; the @sima/neat-ui/${name} entry point was not built`,
      );
    }
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
    'dist/neat-ui: every entry point built, no secondary entry code in the primary, no helm alias imports, compiled stylesheet present.',
  );
}

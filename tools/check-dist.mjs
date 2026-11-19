// `npm run check:dist`: fails when dist/neat-ui would ship a broken package. ng-packagr builds
// green even when vendored helm code still imports through the `@neat-ui/helm` alias (it treats
// the alias as an external package, which no app can resolve), and `ng build neat-ui` alone leaves
// out the compiled stylesheet that styles/neat-ui.css imports. It also cannot tell that the code of
// a secondary entry point (video, switch, ...) leaked back into the primary, which would put it in
// every page's bundle again, that something reached for one of the rendering bench's dev
// dependencies, which no app installs, or that the diagram's bench seam was shipped. Run after
// `npm run build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
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
  bev: ['neat-bev'],
  callout: ['neat-callout'],
  card: ['neat-card'],
  charts: [
    'neat-sparkline',
    'neat-time-chart',
    'neat-stacked-chart',
    'neat-heatmap',
    'neat-chart-card',
  ],
  'code-block': ['neat-code-block', 'neat-copy-button'],
  collapsible: ['neat-collapsible'],
  confirm: ['neat-confirm-dialog'],
  details: ['dl[neatDetails]'],
  diagram: [
    'neat-diagram',
    'neat-diagram-legend',
    'neat-diagram-messages',
    'neat-diagram-rate-card',
    'neat-diagram-animation-settings',
    'ng-template[neatDiagramBlock]',
    'ng-template[neatDiagramEdgeTip]',
    'ng-template[neatDiagramNote]',
    '[neatDiagramNoteBox]',
  ],
  dialog: ['neat-dialog-panel', 'neat-dialog-body', 'neat-dialog-actions'],
  'drop-zone': ['neat-drop-zone'],
  field: ['neat-field', 'neat-error-note'],
  'file-browser': ['neat-file-browser'],
  input: ['input[neatInput]'],
  'level-meter': ['neat-level-meter'],
  'line-list': ['ul[neatLineList]', 'li[neatLine]', '[neatLineEnd]'],
  // Glyphs only: no selector for the primary to leak, so it is listed for the FESM check alone.
  lucide: [],
  'number-field': ['neat-number-field'],
  popover: [
    'neat-popover',
    'ng-template[neatPopoverContent]',
    'button[neatPopoverTrigger]',
    'button[neatPopoverItem]',
    'hr[neatPopoverDivider]',
  ],
  progress: ['neat-progress'],
  segmented: ['neat-segmented'],
  select: ['neat-select'],
  'select-list': ['neat-select-list', 'ng-template[neatColumn]'],
  slider: ['neat-slider'],
  'search-palette': ['neat-search-palette'],
  'status-chip': ['neat-status-chip', 'button[neatStatusChip]'],
  switch: ['button[neatSwitch]'],
  table: [
    'table[neatTable]',
    'td[neatFigure]',
    'th[neatFigure]',
    'td[neatNumeric]',
    'th[neatNumeric]',
  ],
  tabs: ['neat-tabs', 'neat-tab'],
  toast: ['neat-toast-host'],
  video: ['neat-video-tile', 'neat-tile-grid', 'neat-roi-editor', 'neat-roi-swatch'],
};
/**
 * The dev dependencies no app installs: the rendering bench's (AGENTS.md "The rendering bench"),
 * which the lint rules keep under projects/bench/, and the showcase's `lucide-static` (its icon
 * finder's tags), kept under projects/showcase/. A quoted specifier of one (an import, an export, a
 * dynamic import, a manifest's dependency) anywhere in the package means it would reach apps that
 * never install it. `playwright-core` is what `playwright` wraps. sharp is the docs' capture tool's,
 * held to the same.
 */
export const DEV_ONLY = [
  'ngx-vflow',
  'd3-drag',
  'playwright',
  'playwright-core',
  'source-map',
  'sharp',
  'lucide-static',
];
const DEV_SPECIFIER = new RegExp(`['"](${DEV_ONLY.join('|')})(/[^'"]*)?['"]`, 'g');

/**
 * The diagram entry's bench seam (AGENTS.md "The rendering bench"): internals the bench alone may
 * import, never in `public-api.ts`. The package's code uses the same internals, so their names are
 * in it; what must not be there is any of them exported by the diagram entry, or the seam's file
 * named (a source map lists every file a bundle was built from). The names are read from the seam
 * itself, so it can change without this list falling behind.
 */
const SEAM_FILE = fileURLToPath(
  new URL('../projects/neat-ui/diagram/src/bench-seam.ts', import.meta.url),
);
const SEAM_BASENAME = 'bench-seam';
/**
 * The files that make up the diagram entry, where the seam's names must not be exported. Other
 * entries may export a name of their own that is also one of the seam's (a `Rect` of the video
 * ROI editor, say): the seam's file name is checked package-wide, its names only here.
 */
const DIAGRAM_ENTRY_FILES =
  /^(?:fesm2022\/sima-neat-ui-diagram\.mjs|types\/sima-neat-ui-diagram\.d\.ts|diagram\/.*\.d\.ts)$/;

/** The entries of every `export { … }` and `export type { … }` list, `a as b` as written. */
function exportListEntries(source) {
  return Array.from(source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)).flatMap((match) =>
    match[1]
      .split(',')
      .map((part) => part.trim().replace(/^type\s+/, ''))
      .filter(Boolean),
  );
}

/** The names the seam's `export { … } from` lists make public, in order. */
export function seamNames(source) {
  return exportListEntries(source).map((entry) => entry.split(/\s+as\s+/).at(-1));
}

export const SEAM_NAMES = seamNames(readFileSync(SEAM_FILE, 'utf8'));

/**
 * The names a built module or declaration file exports, with the local name of an `a as b` too,
 * so a seam name exported under another one is still found.
 */
function exportedNames(source) {
  const declared = Array.from(
    source.matchAll(
      /export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|function|const|let|var|type|interface|enum)\s+([\w$\u0275]+)/g,
    ),
    (match) => match[1],
  );
  const listed = exportListEntries(source).flatMap((entry) => entry.split(/\s+as\s+/));
  return new Set([...declared, ...listed]);
}

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
    const source = readFileSync(file, 'utf8');
    if (source.includes(ALIAS)) problems.push(`${file} references ${ALIAS}`);
    const devOnly = new Set(Array.from(source.matchAll(DEV_SPECIFIER), (match) => match[1]));
    for (const name of devOnly) {
      problems.push(`${file} references ${name}, a dev dependency no app installs`);
    }
    if (source.includes(SEAM_BASENAME)) {
      problems.push(`${file} names ${SEAM_BASENAME}; the diagram's bench seam is never shipped`);
    }
    if (DIAGRAM_ENTRY_FILES.test(relative(dist, file).split(sep).join('/'))) {
      const exported = exportedNames(source);
      for (const name of SEAM_NAMES.filter((candidate) => exported.has(candidate))) {
        problems.push(`${file} exports ${name}, which only the diagram's bench seam may expose`);
      }
    }
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
    'dist/neat-ui: every entry point built, no secondary entry code in the primary, no helm alias, dev-only imports or bench seam, compiled stylesheet present.',
  );
}

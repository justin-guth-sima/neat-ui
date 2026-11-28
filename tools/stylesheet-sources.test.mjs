// The kit stylesheet compiles the utilities its sources name (`neat-ui.tailwind.css`). Vendored
// helm (`lib/ui/<name>`) that no kit file imports is read only as text by drift specs: the kit's
// own tables hold the classes it copied, so scanning such a folder compiles helm's unused classes
// into every app's stylesheet. A folder a kit file imports must stay scanned, or the classes its
// directives bind are missing. These tests keep the stylesheet's exclusions equal to the folders
// nothing imports.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const KIT = join(ROOT, 'projects/neat-ui');
const UI = join(KIT, 'src/lib/ui');
const STYLESHEET = join(KIT, 'src/styles/neat-ui.tailwind.css');

/** The helm folder a path lies in, or null outside `lib/ui`. */
function helmFolderOf(path) {
  const inside = relative(UI, path);
  if (inside.startsWith('..') || inside === '') return null;
  return inside.split(sep)[0];
}

/** Every kit TypeScript file that ships or runs in an app: no spec, no test helper. */
function runtimeFiles() {
  return readdirSync(KIT, { recursive: true })
    .filter((file) => file.endsWith('.ts'))
    .filter((file) => !file.endsWith('.spec.ts') && !file.endsWith('.testing.ts'))
    .filter((file) => !file.split(sep).includes('node_modules'))
    .map((file) => join(KIT, file));
}

/** The helm folders a file imports by relative path, statically or dynamically. */
function helmImportsOf(file) {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/(?:from|import\()\s*['"](\.[^'"]+)['"]/g)].map(
    (m) => m[1],
  );
  return specifiers
    .map((specifier) => helmFolderOf(resolve(dirname(file), specifier)))
    .filter((folder) => folder !== null);
}

/** The helm folders a kit file reaches, through other helm folders too (tabs imports button). */
function importedHelmFolders() {
  const files = runtimeFiles();
  const reached = new Set(
    files.filter((file) => helmFolderOf(file) === null).flatMap(helmImportsOf),
  );
  for (let grew = true; grew;) {
    grew = false;
    for (const file of files) {
      if (!reached.has(helmFolderOf(file))) continue;
      for (const folder of helmImportsOf(file)) {
        if (!reached.has(folder)) {
          reached.add(folder);
          grew = true;
        }
      }
    }
  }
  return reached;
}

/**
 * The stylesheet's `@source` lines, each at the start of its line, which leaves comments out (a
 * comment's lines start with `/*` or ` *`; a source's own `/**` would fool a comment stripper).
 */
function sourceLines() {
  return readFileSync(STYLESHEET, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('@source '));
}

/** The helm folders the stylesheet leaves out of its scan. */
function excludedHelmFolders() {
  return sourceLines()
    .map((line) => /^@source not '\.\.\/lib\/ui\/([a-z-]+)\/\*\*';$/.exec(line)?.[1])
    .filter((folder) => folder !== undefined);
}

test('the stylesheet scans exactly the helm folders a kit file imports', () => {
  const folders = readdirSync(UI, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const imported = importedHelmFolders();
  const unimported = folders.filter((folder) => !imported.has(folder)).sort();

  assert.ok(imported.has('utils'), 'the scan of imports finds the helm util every wrapper uses');
  assert.deepEqual([...excludedHelmFolders()].sort(), unimported);
});

test('the helm exclusions come after every positive source, where they apply', () => {
  // Tailwind applies an exclusion only to the sources declared above it.
  const lines = sourceLines();
  const lastPositive = lines.findLastIndex((line) => !line.startsWith('@source not '));
  const firstHelmExclusion = lines.findIndex((line) => line.startsWith("@source not '../lib/ui/"));
  assert.ok(lastPositive >= 0, 'the stylesheet has positive sources');
  assert.ok(firstHelmExclusion > lastPositive);
});

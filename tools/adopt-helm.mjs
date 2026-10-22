// Adopts freshly generated Spartan helm code into the kit. tools/helm-add.mjs runs it after the
// generator; it is idempotent, so it re-formats already adopted code without changing it.
//  1. Alias imports (`@neat-ui/helm/<name>`) become relative. ng-packagr treats every non-relative
//     specifier as an external package, so an alias would survive into dist/ and break every app.
//  2. `@ng-icons` glyphs become `neat-icon` with the NEAT_ICONS name that draws the same Lucide
//     glyph, so the kit ships one icon set. A glyph the registry lacks fails the run.
//  3. Spartan's descendant selectors for `ng-icon` are pointed at `neat-icon`.
//  4. Anything left over that would leak the alias or ng-icons fails the run instead of shipping.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import * as prettier from 'prettier';

export const HELM_ROOT = 'projects/neat-ui/src/lib/ui';
const ICON_REGISTRY = 'projects/neat-ui/src/lib/icon/icon-registry.ts';
const NEAT_ICON_MODULE = 'projects/neat-ui/src/lib/icon/icon';
/** Spartan sizes icons at 1em through classes; neat-icon takes pixels, and 16 px is that 1em. */
const ICON_PX = 16;

const HELM_IMPORT = /from (['"])@neat-ui\/helm\/([a-z-]+)\1/g;
const NG_ICONS_IMPORT = /^import \{([^}]*)\} from '@ng-icons\/(core|lucide)';\n/gm;
const ICON_PROVIDERS = /^([ \t]*)(providers|viewProviders): \[([^\]]*)\],\n/gm;
const PROVIDE_ICONS = /provideIcons\(\{[^}]*\}\)/;
const RESIDUE = /@neat-ui\/helm|@ng-icons|\bNgIcon\b|provideIcons|\bng-icon\b|\blucide[A-Z]\w*/;

/**
 * Maps `@ng-icons/lucide` glyph names (`lucideInfo`) to the NEAT_ICONS names whose Lucide glyph
 * matches (`info: LucideInfo`). A glyph two names share maps to `null`: adopting it is ambiguous.
 */
export function glyphsFromRegistry(registrySource) {
  const glyphs = new Map();
  const entries = registrySource.matchAll(/^\s*(?:'([^']+)'|(\w+)):\s*Lucide(\w+),\s*$/gm);
  for (const [, quotedName, bareName, glyph] of entries) {
    const key = `lucide${glyph}`;
    glyphs.set(key, glyphs.has(key) ? null : (quotedName ?? bareName));
  }
  return glyphs;
}

function relativeImport(file, target) {
  const path = posix.relative(posix.dirname(file), target);
  return path.startsWith('.') ? path : `./${path}`;
}

function relativizeHelmImports(file, source) {
  return source.replace(
    HELM_IMPORT,
    (_, _quote, name) => `from '${relativeImport(file, posix.join(HELM_ROOT, name, 'src'))}'`,
  );
}

/** Removes `provideIcons(...)` from providers arrays, and an array it leaves empty. */
function dropIconProviders(source) {
  return source.replace(ICON_PROVIDERS, (_, indent, key, list) => {
    const rest = list
      .replace(new RegExp(`${PROVIDE_ICONS.source},\\s*`), '')
      .replace(new RegExp(`,?\\s*${PROVIDE_ICONS.source}`), '');
    return rest.trim() ? `${indent}${key}: [${rest}],\n` : '';
  });
}

function swapIcons(file, source, glyphs) {
  if (!source.includes('@ng-icons/')) return source;
  const withoutImports = source.replace(NG_ICONS_IMPORT, (_, names, from) => {
    const unexpected = names
      .split(',')
      .map((name) => name.trim())
      .filter(
        (name) => name && !(from === 'core' ? /^(NgIcon|provideIcons)$/ : /^lucide\w+$/).test(name),
      );
    if (unexpected.length) {
      throw new Error(`${file}: cannot adopt ng-icon import of ${unexpected.join(', ')}`);
    }
    return '';
  });
  const swapped = dropIconProviders(withoutImports)
    .replace(/\bNgIcon\b/g, 'NeatIcon')
    .replace(/<ng-icon(\s+)name="(lucide\w+)"/g, (_, space, glyph) => {
      const name = glyphs.get(glyph);
      if (name === undefined) {
        throw new Error(`${file}: no neat-icon for ${glyph}; add a NEAT_ICONS entry drawing it`);
      }
      if (name === null) {
        throw new Error(`${file}: ${glyph} is ambiguous; several NEAT_ICONS entries draw it`);
      }
      return `<neat-icon${space}name="${name}" [size]="${ICON_PX}"`;
    })
    .replace(/<\/ng-icon>/g, '</neat-icon>');
  return `import { NeatIcon } from '${relativeImport(file, NEAT_ICON_MODULE)}';\n${swapped}`;
}

function retargetIconSelectors(source) {
  return source.replace(/\[&_ng-icon/g, '[&_neat-icon').replace(/\*:\[ng-icon/g, '*:[neat-icon');
}

/** Adopts one helm source file. `file` is its path from the repository root (POSIX separators). */
export function adoptSource(file, source, glyphs) {
  const adopted = retargetIconSelectors(
    swapIcons(file, relativizeHelmImports(file, source), glyphs),
  );
  const residue = RESIDUE.exec(adopted);
  if (residue) throw new Error(`${file}: cannot adopt ng-icon or alias usage "${residue[0]}"`);
  return adopted;
}

function* typeScriptFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = posix.join(dir, entry.name);
    if (entry.isDirectory()) yield* typeScriptFiles(path);
    else if (entry.name.endsWith('.ts')) yield path;
  }
}

/** Adopts and formats every helm file in place. Run from the repository root. */
export async function adoptHelmTree() {
  const glyphs = glyphsFromRegistry(readFileSync(ICON_REGISTRY, 'utf8'));
  for (const file of typeScriptFiles(HELM_ROOT)) {
    const source = readFileSync(file, 'utf8');
    const options = { ...(await prettier.resolveConfig(file)), filepath: file };
    const adopted = await prettier.format(adoptSource(file, source, glyphs), options);
    if (adopted !== source) writeFileSync(file, adopted);
  }
}

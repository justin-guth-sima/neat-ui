// `npm run helm:add -- <name>`: the only way Spartan helm code enters the kit.
//  1. Installs @spartan-ng/cli at the pinned @spartan-ng/brain version without saving it: the CLI
//     brings Nx and dev-only audit findings that have no place in package.json or the lockfile.
//  2. Runs its `ui` generator (configured by components.json) into projects/neat-ui/src/lib/ui.
//  3. Restores package.json, package-lock.json and tsconfig.json. The generator adds alias paths
//     (adoption makes the imports relative instead) and dependencies, which the kit declares
//     deliberately, in both package.json files, after checking their licence. A dependency the kit
//     does not declare yet fails the run.
//  4. Runs `npm install`, which puts node_modules back to the lockfile and prunes the CLI (also
//     after the generator's own `npm install`, which it runs when it adds dependencies).
//  5. Adopts the generated code (tools/adopt-helm.mjs).
// On failure the new helm folders are removed again, so nothing unadopted is left behind.
// To update a component, delete its folder and add it again, then review the diff.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adoptHelmTree, HELM_ROOT } from './adopt-helm.mjs';

const RESTORED = ['package.json', 'package-lock.json', 'tsconfig.json'];
/** The generator's icon packages; adoption replaces them with neat-icon. */
const DROPPED_DEPENDENCY = /^@ng-icons\//;

const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' });
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const allDependencies = (pkg) => ({ ...pkg.dependencies, ...pkg.devDependencies });
const helmFolders = () => (existsSync(HELM_ROOT) ? readdirSync(HELM_ROOT) : []);

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const name = process.argv[2];
if (!name || !/^[a-z][a-z-]*$/.test(name)) {
  throw new Error('Usage: npm run helm:add -- <component>, for example `button`');
}
if (existsSync(posix.join(HELM_ROOT, name))) {
  throw new Error(`${HELM_ROOT}/${name} exists; delete it first to regenerate it`);
}
const declared = allDependencies(readJson('package.json'));
const brainVersion = declared['@spartan-ng/brain'];
if (!/^\d+\.\d+\.\d+$/.test(brainVersion ?? '')) {
  throw new Error('@spartan-ng/brain must be pinned to an exact version in package.json');
}

const snapshot = new Map(RESTORED.map((file) => [file, readFileSync(file, 'utf8')]));
const foldersBefore = new Set(helmFolders());
const addedFolders = () => helmFolders().filter((folder) => !foldersBefore.has(folder));

/** Generates the component; returns dependencies it needs that the kit does not declare. */
function generate() {
  run('npm', [
    'install',
    '--no-save',
    '--no-audit',
    '--no-fund',
    `@spartan-ng/cli@${brainVersion}`,
  ]);
  const supported = readJson(
    'node_modules/@spartan-ng/cli/src/generators/ui/supported-ui-libraries.json',
  );
  if (!(name in supported)) throw new Error(`Spartan ${brainVersion} has no helm "${name}"`);
  run('npx', ['ng', 'generate', '@spartan-ng/cli:ui', name]);
  return Object.entries(allDependencies(readJson('package.json'))).filter(
    ([dependency]) => !(dependency in declared) && !DROPPED_DEPENDENCY.test(dependency),
  );
}

try {
  let undeclared;
  try {
    undeclared = generate();
  } finally {
    for (const [file, contents] of snapshot) writeFileSync(file, contents);
    run('npm', ['install', '--no-audit', '--no-fund']);
  }
  if (undeclared.length) {
    const list = undeclared.map(([dependency, range]) => `${dependency}@${range}`).join(', ');
    throw new Error(
      `"${name}" needs ${list}. Check the licence, add it to package.json, ` +
        'projects/neat-ui/package.json and allowedNonPeerDependencies, then run this again.',
    );
  }
  await adoptHelmTree();
} catch (error) {
  for (const folder of addedFolders()) rmSync(posix.join(HELM_ROOT, folder), { recursive: true });
  // The generator may also have rewritten folders that already existed; adopt them again.
  if (helmFolders().length) await adoptHelmTree();
  throw error;
}
console.log(`Adopted ${addedFolders().join(', ')} into ${HELM_ROOT}. Review the diff, lint, test.`);

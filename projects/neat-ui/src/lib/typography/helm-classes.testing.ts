/*
 * Spec support for the helm drift checks: the class names a vendored helm file states, read from
 * its text (imported with `?source`), and the set a kit part takes from them. Every drift check
 * compares sets both ways with it: the kit's classes are helm's less a named list of departures
 * and plus a named list of additions, so a class helm adds and one it drops both fail until the
 * kit's copy is reviewed. Not part of the package (`*.testing.ts` is left out of its build).
 */

/** The text between the bracket at `open` and the one that closes it, skipping quoted text. */
function balanced(text: string, open: number): string {
  const close: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  let quote = '';
  for (let i = open; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char in close) {
      stack.push(close[char]);
    } else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error(`no closing bracket for the one at ${open}`);
}

/** The class names of every string literal in `text` (quoted, or a template without `${}`). */
function literals(text: string): string[] {
  const names = [...text.matchAll(/'([^']*)'|"([^"]*)"|`([^`$]*)`/g)].flatMap((match) =>
    (match[1] ?? match[2] ?? match[3]).split(/\s+/),
  );
  return names.filter(Boolean);
}

/** The value after `key:` in `text`: one string literal, or an array of them. */
function valueOf(text: string, key: string): string[] {
  const at = new RegExp(`\\b${key}['"]?:\\s*`).exec(text);
  if (!at) throw new Error(`no "${key}:" in the helm file`);
  const start = at.index + at[0].length;
  if (text[start] === '[') return literals(balanced(text, start));
  const string = /^'([^']*)'|^"([^"]*)"/.exec(text.slice(start));
  if (!string) throw new Error(`"${key}:" holds no class string`);
  return literals(string[0]);
}

/**
 * The class names of a constant the helm file exports (`export const hlmH1 = '…'`): the one named,
 * or the file's first `hlm…` constant.
 */
export function helmConstant(source: string, name = 'hlm\\w+'): string[] {
  const match = new RegExp(`export const ${name}\\s*=\\s*('[^']*'|"[^"]*")`).exec(source);
  if (!match) throw new Error(`no class constant ${name} in the helm file`);
  return literals(match[1]);
}

/**
 * The class names a helm directive's `classes(() => …)` call states, a string or an array of
 * them; `directive` names the class whose call it is, in a file of several.
 */
export function helmHostClasses(source: string, directive?: string): string[] {
  const from = directive ? source.indexOf(`export class ${directive} `) : 0;
  if (from < 0) throw new Error(`no class ${directive} in the helm file`);
  const call = source.indexOf('classes(', from);
  if (call < 0) throw new Error('no classes() call in the helm file');
  const names = literals(balanced(source, call + 'classes'.length));
  if (names.length === 0) throw new Error('the classes() call holds no class string');
  return names;
}

/** The class names of the base of the helm file's `cva(…)`, its first argument. */
export function helmCvaBase(source: string): string[] {
  const call = source.indexOf('cva(');
  if (call < 0) throw new Error('no cva() in the helm file');
  const args = balanced(source, call + 'cva'.length);
  const base = /^\s*('[^']*'|"[^"]*")/.exec(args);
  if (!base) throw new Error('the cva() base is not one class string');
  return literals(base[1]);
}

/**
 * The class names of a variant value of the helm file's `cva(…)`, such as its `icon` media or an
 * `align` of `'inline-start'` (a quoted key).
 */
export function helmCvaVariant(source: string, variant: string): string[] {
  const call = source.indexOf('cva(');
  if (call < 0) throw new Error('no cva() in the helm file');
  return valueOf(balanced(source, call + 'cva'.length), variant);
}

/** Class names as a set: sorted, each once. */
export function classSet(names: Iterable<string>): string[] {
  return [...new Set(names)].sort();
}

/** What a kit part changes about helm's classes, each change named in its own list. */
export interface HelmDepartures {
  /** Helm's classes the part leaves out or replaces. */
  readonly departures?: readonly string[];
  /** Classes the part has that helm's do not: its replacements and its own. */
  readonly additions?: readonly string[];
}

/**
 * The set a kit part takes from helm's `helm` classes: less the departures, plus the additions.
 * A departure helm no longer has, or an addition helm has itself, throws, so the lists stay true.
 */
export function takenFromHelm(
  helm: readonly string[],
  { departures = [], additions = [] }: HelmDepartures = {},
): string[] {
  for (const name of departures) {
    if (!helm.includes(name)) throw new Error(`"${name}" is a departure helm no longer has`);
  }
  for (const name of additions) {
    if (helm.includes(name)) throw new Error(`"${name}" is no addition: helm has it`);
  }
  return classSet([...helm.filter((name) => !departures.includes(name)), ...additions]);
}

/**
 * Helm's heading classes the kit's typography leaves out, in its directives and in `neatProse`
 * alike: a scroll margin, since `neat-page` owns where a fragment link stops (typography.ts).
 */
export const TYPOGRAPHY_DEPARTURES: readonly string[] = ['scroll-m-20'];

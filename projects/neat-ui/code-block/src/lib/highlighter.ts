import { isDevMode } from '@angular/core';
import type {
  codeToTokensBase,
  LanguageRegistration,
  ShikiPrimitive,
  ThemedToken,
} from '@shikijs/primitive';
import { CODE_THEME, kindOf } from './code-theme';
import type { NeatCodeLanguages } from './languages';
import { codeLines, plainLines, type CodeLine, type CodeRun } from './lines';

/** The lines of code in one language, colored, or plain where the grammar fails on the code. */
export interface CodeHighlighter {
  lines(code: string): CodeLine[];
}

type GrammarImport = NeatCodeLanguages[string];

/** Shiki's tokenizer with the kit's theme, and the function that tokenizes with it. */
interface Shiki {
  readonly primitive: ShikiPrimitive;
  readonly tokenize: typeof codeToTokensBase;
}

/**
 * Shiki's tokenizer and its pure-JavaScript regular expression engine (no WebAssembly), loaded on
 * the first use of any language and kept for the page. Only dynamic imports reach Shiki, so a page
 * without a colored block loads none of it.
 */
let shiki: Promise<Shiki> | undefined;

function loadShiki(): Promise<Shiki> {
  shiki ??= Promise.all([import('@shikijs/primitive'), import('@shikijs/engine-javascript')]).then(
    ([{ codeToTokensBase, createShikiPrimitive }, { createJavaScriptRegexEngine }]) => ({
      primitive: createShikiPrimitive({
        engine: createJavaScriptRegexEngine(),
        themes: [CODE_THEME],
        langs: [],
      }),
      tokenize: codeToTokensBase,
    }),
  );
  shiki.catch(() => (shiki = undefined));
  return shiki;
}

/**
 * No time limit on a line (`tokenizeTimeLimit: 0`; Shiki's default is 500 ms). The limit is VS
 * Code's, for an editor that tokenizes a line again later: a line that runs past it stops where it
 * is, its rest one plain run, and the lines after it go on from the state it stopped in. A block
 * tokenizes once and keeps its colors, so a stopped line stayed wrong. What ran past the limit was
 * not long code but the grammar's regular expressions compiled on their first use, which the first
 * lines of a block pay for: a cold C++ grammar's first two lines took 730 and 200 ms on an idle
 * laptop, so a slower CPU (the board's) or a busy one left the second line plain. The limit bounded
 * each line (to about 500 ms and one match), but never a block's total time, nor a single match,
 * since the clock is read only between two matches. Long lines are bounded by `MAX_LINE_LENGTH`.
 */
const NO_TIME_LIMIT = 0;

/**
 * A line of this many characters or more is shown plain, untokenized (Shiki's
 * `tokenizeMaxLineLength`), and the lines after it go on from the state before it. Why: with no
 * time limit nothing else bounds a long line, and a streamed reply's code block tokenizes its whole
 * code again on every piece (100 kB of one TypeScript line took 640 ms each time on a laptop, the
 * board's CPU several times longer). Lower than VS Code's 20 000 for that reason: a line this long
 * is not code a reader follows by its colors.
 */
const MAX_LINE_LENGTH = 5_000;

/** Each grammar's highlighter, kept for the page by the function that imports it. */
const highlighters = new Map<GrammarImport, Promise<CodeHighlighter>>();

/** A line's tokens as runs, neighbors of one kind joined. */
function runsOf(tokens: readonly ThemedToken[]): CodeRun[] {
  const runs: CodeRun[] = [];
  for (const token of tokens) {
    const kind = kindOf(token.color);
    const last = runs[runs.length - 1];
    if (last?.kind === kind) runs[runs.length - 1] = { text: last.text + token.content, kind };
    else runs.push({ text: token.content, kind });
  }
  return runs;
}

/** The highlighter of the grammar `load` imports, loading Shiki and the grammar on first use. */
function loadHighlighter(load: GrammarImport): Promise<CodeHighlighter> {
  let highlighter = highlighters.get(load);
  if (highlighter) return highlighter;
  highlighter = Promise.all([loadShiki(), load()]).then(([{ primitive, tokenize }, grammar]) => {
    const registrations = grammar.default as LanguageRegistration[];
    primitive.loadLanguageSync(registrations);
    // A module lists the grammars the language embeds first, and its own last.
    const lang = registrations[registrations.length - 1].name;
    const options = {
      lang,
      theme: CODE_THEME.name,
      tokenizeTimeLimit: NO_TIME_LIMIT,
      tokenizeMaxLineLength: MAX_LINE_LENGTH,
    };
    return {
      lines: (code) => {
        try {
          return codeLines(tokenize(primitive, code, options).map(runsOf));
        } catch (error) {
          warnOnce(`could not color code in "${lang}", so it shows plain`, error);
          return plainLines(code);
        }
      },
    };
  });
  highlighters.set(load, highlighter);
  highlighter.catch(() => highlighters.delete(load));
  return highlighter;
}

/** What was already said in dev mode, so each problem is said once however many blocks have it. */
const warned = new Set<string>();

/** Says `problem` once in dev mode, with `detail` (an error) after it the first time. */
function warnOnce(problem: string, ...detail: unknown[]): void {
  if (!isDevMode() || warned.has(problem)) return;
  warned.add(problem);
  console.warn(`neat-code-block: ${problem}`, ...detail);
}

/**
 * The highlighter of `language` from `languages`, or `undefined` when the code stays plain: for a
 * language the table does not name, or a grammar that did not load, each said once in dev mode.
 */
export async function highlighterFor(
  language: string,
  languages: NeatCodeLanguages,
): Promise<CodeHighlighter | undefined> {
  if (!Object.hasOwn(languages, language)) {
    warnOnce(
      `no grammar for the language "${language}", so its code shows plain; add one with provideNeatCodeLanguages`,
    );
    return undefined;
  }
  try {
    return await loadHighlighter(languages[language]);
  } catch (error) {
    warnOnce(`the grammar of "${language}" did not load, so its code shows plain: ${error}`);
    return undefined;
  }
}

/**
 * Forgets the problems already said. For specs only: the spec runner shares this module between
 * spec files, so without it one file's message would silence the same message in a later file.
 */
export function resetWarned(): void {
  warned.clear();
}

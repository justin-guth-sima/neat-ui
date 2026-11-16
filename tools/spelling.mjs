/*
 * The repo's spelling is American English, in prose and in code alike (docs/writing.md). This finds
 * the British spellings the kit used to have, so they do not come back: the stems below as parts
 * of words (a camelCase name follows them), and a few whole words whose stems are also nouns. HTML's
 * own `aria-labelledby` and the deprecated British aliases kept for apps are allowed.
 */

/** British stems found as parts of words, with what American English writes. */
export const BRITISH_STEMS = [
  ['anticlockwise', 'counterclockwise'],
  ['colour', 'color'],
  ['centre', 'center'],
  ['centred', 'centered'],
  ['grey', 'gray'],
  ['metre', 'meter'],
  ['behaviour', 'behavior'],
  ['favour', 'favor'],
  ['honour', 'honor'],
  ['harbour', 'harbor'],
  ['neighbour', 'neighbor'],
  ['labelling', 'labeling'],
  ['labelled', 'labeled'],
  ['cancelling', 'canceling'],
  ['cancelled', 'canceled'],
  ['travelling', 'traveling'],
  ['travelled', 'traveled'],
  ['modelled', 'modeled'],
  ['judgement', 'judgment'],
  ['licence', 'license'],
  ['summaris', 'summariz'],
  ['rasteris', 'rasteriz'],
  ['initialis', 'initializ'],
  ['neutralis', 'neutraliz'],
  ['optimis', 'optimiz'],
  ['quantis', 'quantiz'],
  ['customis', 'customiz'],
];

/** British words found only whole: their stems are also English nouns (synthesis, analyses). */
export const BRITISH_WORDS = [
  ['synthesise', 'synthesize'],
  ['emphasise', 'emphasize'],
  ['analyse', 'analyze'],
  ['analysed', 'analyzed'],
  ['analyser', 'analyzer'],
  ['analysing', 'analyzing'],
];

/**
 * Words with a British stem that stay: HTML's `aria-labelledby` (and names after it, such as
 * Spartan's `ariaLabelledby` input), and the deprecated aliases kept for apps.
 */
export const ALLOWED = new Set(['neatLabelColour']);
const isAllowed = (word) => ALLOWED.has(word) || word.toLowerCase().includes('labelledby');

/** Allowed in one file only: the deprecated `colours` input of the diagram's messages, and so on. */
export const ALLOWED_IN = new Map([
  ['projects/neat-ui/diagram/src/lib/messages/messages.ts', new Set(['colours'])],
  ['projects/neat-ui/diagram/src/lib/messages/messages.spec.ts', new Set(['colours'])],
  ['projects/showcase/src/app/docs/generated/api/diagram.ts', new Set(['colours'])],
  ['projects/showcase/src/app/docs/generated/search-index.ts', new Set(['colours'])],
  ['docs/components/messaging.md', new Set(['colours'])],
  // The rule that names the aliases, and the writing guide's list of what not to write.
  ['AGENTS.md', new Set(['colours'])],
  ['docs/writing.md', new Set(['colour', 'centre', 'grey', 'metres'])],
  // This checker names what it looks for.
  ['tools/spelling.mjs', null],
  ['tools/spelling.test.mjs', null],
]);

// Longest first, so a stem that starts another (centre, centred) names the longer one.
const byLength = (list) => list.map(([british]) => british).sort((a, b) => b.length - a.length);
const stems = new RegExp(byLength(BRITISH_STEMS).join('|'), 'i');
const words = new RegExp(`(?<![A-Za-z])(${byLength(BRITISH_WORDS).join('|')})(?![a-z])`, 'i');

/**
 * The British spellings in `text` (a file at `path`): each with its line, the word it is in and
 * what American English writes for the stem.
 */
export function britishIn(path, text) {
  const allowedHere = ALLOWED_IN.get(path);
  if (allowedHere === null) return [];
  const found = [];
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(/[A-Za-z]+/g)) {
      const word = match[0];
      if (isAllowed(word) || allowedHere?.has(word)) continue;
      const stem = stems.exec(word)?.[0] ?? words.exec(word)?.[1];
      if (!stem) continue;
      const pairs = [...BRITISH_STEMS, ...BRITISH_WORDS];
      const american = pairs.find(([british]) => british === stem.toLowerCase())?.[1];
      found.push({ path, line: index + 1, word, american });
    }
  });
  return found;
}

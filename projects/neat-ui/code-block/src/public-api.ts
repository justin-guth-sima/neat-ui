/*
 * Public API surface of @sima/neat-ui/code-block: code set apart, colored by language, with marks
 * and steps through it, notes on them in a bubble and a Copy button, and the Copy button on its
 * own. A secondary entry point, so an app's main bundle carries it only if a page it loads imports
 * it. It imports the primary entry point (`@sima/neat-ui`) and `@sima/neat-ui/bubble` by package
 * name; the primary never imports it. Every export added here is a promise to consumers.
 */
export { NeatCodeBlock, type NeatCodeOverflow } from './lib/code-block';
export { NeatCopyButton } from './lib/copy-button';
export type { NeatCodeMark, NeatCodeStep } from './lib/marks';
export { NeatCodeNote, type NeatCodeNoteContext } from './lib/note';
export { provideNeatCodeLanguages, type NeatCodeLanguages } from './lib/languages';

import type { PieceGroup } from './shown';

/**
 * How a streaming reply's newest text appears in `neat-markdown` (its `motion`), in prose only:
 * code blocks, tables and inline code grow plainly.
 *
 * - `plain`: the text as it comes, with a thin caret at its end.
 * - `focus`: each piece comes into focus from a blur in the primary color.
 * - `heat-trail`: each piece arrives white-hot and cools, behind a glowing caret.
 * - `decrypt`: pieces show as glyph noise and resolve from the start, with a tail of noise to the
 *   end of the next line.
 * - `reverse-explosion`: particles condense from around each piece into its place.
 * - `token-flash`: each piece flashes on a chip in one of four hues, then fades.
 * - `drop-in`: the letters of each word drop in one after another.
 * - `word-cloud`: words float under the reply's end; one flies into place with each piece.
 *
 * Under reduced motion every motion shows as `plain`.
 */
export type NeatTextMotion =
  | 'plain'
  | 'focus'
  | 'heat-trail'
  | 'decrypt'
  | 'reverse-explosion'
  | 'token-flash'
  | 'drop-in'
  | 'word-cloud';

/** Every `NeatTextMotion`, in the order a picker lists them. */
export const NEAT_TEXT_MOTIONS: readonly NeatTextMotion[] = [
  'plain',
  'focus',
  'heat-trail',
  'decrypt',
  'reverse-explosion',
  'token-flash',
  'drop-in',
  'word-cloud',
];

/** What a motion needs of the pieces, stated once: how long a piece moves, how it is cut. */
export interface TextMotionRules {
  /** How long a piece moves (ms); the CSS reads it as `--neat-motion-ms`. */
  readonly settleMs: number;
  readonly group: PieceGroup;
  /** Which caret ends the text while it streams. */
  readonly caret: 'thin' | 'glow' | 'none';
}

/** Each motion's rules, from the mockups it was chosen from. Internal. */
export const TEXT_MOTIONS: Record<NeatTextMotion, TextMotionRules> = {
  plain: { settleMs: 0, group: 'token', caret: 'thin' },
  focus: { settleMs: 380, group: 'token', caret: 'none' },
  'heat-trail': { settleMs: 1100, group: 'token', caret: 'glow' },
  decrypt: { settleMs: 600, group: 'token', caret: 'none' },
  'reverse-explosion': { settleMs: 520, group: 'token', caret: 'none' },
  'token-flash': { settleMs: 1400, group: 'token', caret: 'none' },
  'drop-in': { settleMs: 420, group: 'word', caret: 'none' },
  'word-cloud': { settleMs: 440, group: 'token', caret: 'none' },
};

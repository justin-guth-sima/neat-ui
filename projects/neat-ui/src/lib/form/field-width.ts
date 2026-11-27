/**
 * How wide a field part is (`neatInput`, `neat-number-field`, `neat-select` and `neat-search` take
 * it as `width`):
 * - `'fill'` (the default): the width of its container, as Spartan draws a field. In a row beside
 *   other items it takes the room they leave.
 * - `'content'`: as wide as what it holds, for a field in a toolbar or beside a heading. A text
 *   field is then as wide as the browser makes an input; a number field is sized to its number and
 *   unit, a select to its choice.
 *
 * Every field part fills by default, so two of them side by side behave the same. An app that
 * needs another width sets it through its own layout, a grid column or the width of the element
 * around the field.
 */
export type NeatFieldWidth = 'fill' | 'content';

/**
 * Each width as the class the field parts put on their outer element: `w-full` is helm's own,
 * `w-fit` its opposite. Internal to the kit; the primary exports it `ɵ` for the entries. Class
 * strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading them.
 */
export const FIELD_WIDTH_CLASSES: Readonly<Record<NeatFieldWidth, string>> = {
  fill: 'w-full',
  content: 'w-fit',
};

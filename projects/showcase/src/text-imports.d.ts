/**
 * Markdown imported with `with { loader: 'text' }` (specs only) arrives as its source text: the
 * Getting started spec reads the kit's README, so the note and the rules it names stay one text.
 */
declare module '*.md' {
  const source: string;
  export default source;
}

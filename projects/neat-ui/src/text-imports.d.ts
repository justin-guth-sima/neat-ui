/** Stylesheets imported with `with { loader: 'text' }` (specs only) arrive as their source text. */
declare module '*.css' {
  const source: string;
  export default source;
}

/**
 * TypeScript sources imported as `<path>.ts?source` with `{ loader: 'text' }` (specs only) arrive
 * as their source text: esbuild drops the query when it resolves the file, and the suffix keeps
 * TypeScript from resolving the module itself. The wrapper specs read vendored helm this way.
 */
declare module '*.ts?source' {
  const source: string;
  export default source;
}

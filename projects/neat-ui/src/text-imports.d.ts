/** Stylesheets imported with `with { loader: 'text' }` (specs only) arrive as their source text. */
declare module '*.css' {
  const source: string;
  export default source;
}

/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses none
 */
declare module 'mjml-preset-core/lib/dependencies.js' {
  const dependencies: Record<string, unknown[]>;
  // biome-ignore lint/style/noDefaultExport: mirrors the real module's default export shape
  export default dependencies;
}

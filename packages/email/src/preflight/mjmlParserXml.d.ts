/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses none
 */
declare module 'mjml-parser-xml' {
  export type MjmlParserNode = {
    tagName: string;
    children?: MjmlParserNode[];
  };

  const parseMjml: (mjml: string) => MjmlParserNode;
  // biome-ignore lint/style/noDefaultExport: mirrors the real module's default export shape
  export default parseMjml;
}

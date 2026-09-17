/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
export const stripComponentBodies = (content: string): string =>
  content.replace(
    /\{\{#component:([a-z0-9-]+)\}\}[\s\S]*?\{\{\/component:\1\}\}/g,
    '{{#component:$1}}{{/component:$1}}',
  );

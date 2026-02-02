/**
 * Expand component refs in MJML - replaces {{#component:slug}}...{{/component:slug}} with content.
 */

import type { SaveContext } from './types';
import { lookupCascade } from './lookupCascade';
import { EmailRenderError } from './errors';

/**
 * Recursively expand all component refs in MJML.
 */
export const expand = async (
  mjml: string,
  componentRefs: string[],
  ctx: SaveContext,
): Promise<string> => {
  if (!componentRefs.length) return mjml;

  // Batch fetch all referenced components
  const components = await lookupCascade(componentRefs, ctx);

  // Replace each component block
  let result = mjml;
  for (const slug of componentRefs) {
    const component = components[slug];
    if (!component) throw new EmailRenderError(slug, 'component_missing');

    // Recursively expand nested refs
    const expanded = await expand(component.mjml, component.componentRefs, ctx);

    // Replace {{#component:slug}}...{{/component:slug}} with expanded MJML
    result = replaceBlock(result, slug, expanded);
  }

  return result;
};

const replaceBlock = (mjml: string, slug: string, content: string): string => {
  const pattern = new RegExp(
    `\\{\\{#component:${slug}\\}\\}[\\s\\S]*?\\{\\{\\/component:${slug}\\}\\}`,
    'g',
  );
  return mjml.replace(pattern, content);
};

/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { EmailRenderError } from '@template/email/render/errors';
import { lookupCascade } from '@template/email/render/lookupCascade';
import type { OwnerScope } from '@template/email/render/types';

/** The expanded document, plus which component rows composed it. A caller needs their ids to read
 * their rule references, and only the cascade knows which override actually resolved. */
export type Expansion = { mjml: string; componentIds: string[] };

export const expand = async (mjml: string, componentRefs: string[], ctx: OwnerScope): Promise<Expansion> => {
  if (!componentRefs.length) return { mjml, componentIds: [] };

  // Batch fetch all referenced components
  const components = await lookupCascade(componentRefs, ctx);

  // Replace each component block
  let result = mjml;
  const componentIds: string[] = [];
  for (const slug of componentRefs) {
    const component = components[slug];
    if (!component) throw new EmailRenderError(slug, 'component_missing');

    // Recursively expand nested refs
    const expanded = await expand(component.mjml, component.componentRefs, ctx);
    componentIds.push(component.id, ...expanded.componentIds);

    // Replace {{#component:slug}}...{{/component:slug}} with expanded MJML
    result = replaceBlock(result, slug, expanded.mjml);
  }

  return { mjml: result, componentIds: [...new Set(componentIds)] };
};

const replaceBlock = (mjml: string, slug: string, content: string): string => {
  const pattern = new RegExp(`\\{\\{#component:${slug}\\}\\}[\\s\\S]*?\\{\\{\\/component:${slug}\\}\\}`, 'g');
  return mjml.replace(pattern, content);
};

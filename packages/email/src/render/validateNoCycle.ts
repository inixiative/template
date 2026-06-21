/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import { EmailRenderError } from '@template/email/render/errors';
import { lookupCascade } from '@template/email/render/lookupCascade';
import type { OwnerScope } from '@template/email/render/types';

export const validateNoCycle = async (savingSlug: string, outgoingRefs: string[], ctx: OwnerScope): Promise<void> => {
  // DFS. Each stack frame carries the chain so the error message can name
  // the full cycle: "A → B → C → A".
  const stack: { slug: string; path: string[] }[] = outgoingRefs.map((ref) => ({
    slug: ref,
    path: [savingSlug, ref],
  }));
  const visited = new Set<string>();

  while (stack.length > 0) {
    const { slug, path } = stack.pop()!;
    if (slug === savingSlug) {
      throw new EmailRenderError(savingSlug, 'circular_ref', path);
    }
    if (visited.has(slug)) continue;
    visited.add(slug);

    const components = await lookupCascade([slug], ctx);
    const component = components[slug];
    if (!component) continue;
    for (const childRef of component.componentRefs) {
      stack.push({ slug: childRef, path: [...path, childRef] });
    }
  }
};

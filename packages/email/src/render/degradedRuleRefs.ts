/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { lookupCascade } from '@template/email/render/lookupCascade';
import type { OwnerScope } from '@template/email/render/types';

type Degradable = { componentRefs: string[]; degradedRuleRefs: string[] };

export const collectDegradedRuleRefs = async (root: Degradable, ctx: OwnerScope): Promise<string[]> => {
  const out = new Set(root.degradedRuleRefs);
  const seen = new Set<string>();
  let frontier = root.componentRefs;
  while (frontier.length) {
    const slugs = frontier.filter((slug) => !seen.has(slug));
    if (!slugs.length) break;
    for (const slug of slugs) seen.add(slug);
    const components = await lookupCascade(slugs, ctx);
    frontier = [];
    for (const component of Object.values(components)) {
      if (!component) continue;
      for (const id of component.degradedRuleRefs) out.add(id);
      frontier.push(...component.componentRefs);
    }
  }
  return [...out];
};

/**
 * Save-side cycle detection. Before persisting a component's new outgoing
 * `componentRefs`, walk them through the DB state (via `lookupCascade` so
 * scope resolution matches `expand`'s render-time behavior) and refuse the
 * save if we ever reach `savingSlug`.
 *
 * Catches cross-save cycles like:
 *   1. Save A.componentRefs = ['B']
 *   2. Save B.componentRefs = ['A']  ← this attempt fails here
 *
 * Intra-save cycles can't happen because `mapRefs` walks MJML text top-down
 * and produces a tree by construction.
 *
 * Direct DB writes (migrations, admin tools) bypass this check — `expand`
 * has no runtime guard, so any cycle introduced outside `saveEmailTemplate`
 * will blow the stack at render time. Render-side belt-and-suspenders is
 * intentionally NOT added here — the save-side fence is the only writer
 * boundary we control, and a render-time guard would mask data bugs
 * silently rather than failing loudly at the source.
 */

import { EmailRenderError } from '@template/email/render/errors';
import { lookupCascade } from '@template/email/render/lookupCascade';
import type { SaveContext } from '@template/email/render/types';

export const validateNoCycle = async (
  savingSlug: string,
  outgoingRefs: string[],
  ctx: SaveContext,
): Promise<void> => {
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

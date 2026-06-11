/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';

export const rootLens = (narrowing: LensNarrowing): Lens => {
  let parent: Lens | LensNarrowing = narrowing.parent;
  while ('parent' in parent) parent = parent.parent;
  return parent;
};

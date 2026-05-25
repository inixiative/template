import { createLens, type FieldMap, type Lens, type LensNarrowing } from '@inixiative/json-rules';
import type { ModelName } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';

export const lensFor = (model: ModelName): Lens =>
  createLens({ maps: { prisma: prismaMap as unknown as FieldMap }, mapName: 'prisma', model });

export const rootLens = (narrowing: LensNarrowing): Lens => {
  let parent: Lens | LensNarrowing = narrowing.parent;
  while ('parent' in parent) parent = parent.parent;
  return parent;
};

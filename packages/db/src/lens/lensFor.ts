import { createLens, type FieldMap, type Lens } from '@inixiative/json-rules';
import type { ModelName } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';

export const lensFor = (model: ModelName): Lens =>
  createLens({ maps: { prisma: prismaMap as unknown as FieldMap }, mapName: 'prisma', model });

/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { createLens, type FieldMap, type Lens } from '@inixiative/json-rules';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { ModelName } from '@template/db/utils/modelNames';

export const lensFor = (model: ModelName): Lens =>
  createLens({ maps: { prisma: prismaMap as unknown as FieldMap }, mapName: 'prisma', model });

/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldOf } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';

/** Whether a model soft-deletes: it has a `deletedAt` column. */
export const hasDeletedAt = (modelName: string): boolean =>
  fieldOf(prismaMap, modelName, 'deletedAt') !== undefined;

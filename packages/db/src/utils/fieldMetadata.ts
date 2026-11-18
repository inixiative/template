/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { ModelField, PrismaMap } from '@inixiative/prisma-map';
import { prismaMap } from '@template/db/generated/prismaMap';

// The generated map is declared `as const` (readonly literal arrays); cast once to the lib's
// structural PrismaMap shape, as prismaMapRelations does.
const MAP = prismaMap.models as unknown as PrismaMap;

const getField = (modelName: string, fieldName: string): ModelField | undefined =>
  MAP[modelName]?.fields?.[fieldName];

export const modelFields = (modelName: string): Record<string, ModelField> | undefined =>
  MAP[modelName]?.fields;

export const hasDeletedAt = (modelName: string): boolean =>
  getField(modelName, 'deletedAt') !== undefined;

export const lookupField = (modelName: string, path: string): ModelField | undefined => {
  const segments = path.split('.');
  let currentModel: string | undefined = modelName;
  for (let i = 0; i < segments.length; i += 1) {
    if (!currentModel) return undefined;
    const field = getField(currentModel, segments[i]);
    if (!field) return undefined;
    if (i === segments.length - 1) return field;
    if (field.kind !== 'object') return undefined;
    currentModel = field.type;
  }
  return undefined;
};

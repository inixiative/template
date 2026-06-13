/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 */
import { getRelations, type Identifier, type PrismaMap } from '@inixiative/prisma-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { type AccessorName, type ModelName, toAccessor, toModelName } from '@template/db/utils/modelNames';

export type { Identifier } from '@inixiative/prisma-map';

// The generated map is declared `as const` (readonly literal arrays); the lib's
// helpers want the structural PrismaMap shape. Cast once at this boundary.
const models = prismaMap.models as unknown as PrismaMap;

export type RelationInfo = {
  relationName: string;
  targetModel: ModelName;
  targetAccessor: AccessorName;
  foreignKey: Identifier | null;
};

// List a model's relations with the target's PascalCase model name + camelCase
// accessor and the foreign key collapsed for lookup. Thin typed wrapper over
// `@inixiative/prisma-map`'s `getRelations` (which is string-keyed).
export const getModelRelations = (modelName: ModelName): RelationInfo[] =>
  getRelations(models, modelName).map((relation) => ({
    relationName: relation.relationName,
    targetModel: relation.targetModel as ModelName,
    targetAccessor: toAccessor(relation.targetModel as ModelName),
    foreignKey: relation.foreignKey,
  }));

export const getAccessorRelations = (accessor: AccessorName): RelationInfo[] => {
  const modelName = toModelName(accessor);
  if (!modelName) throw new Error(`Unknown accessor: ${accessor}`);
  return getModelRelations(modelName);
};

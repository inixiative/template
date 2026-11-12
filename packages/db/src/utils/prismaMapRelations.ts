/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 */
import {
  type Annotations,
  getRelations,
  type Identifier,
  type PrismaMap,
} from '@inixiative/prisma-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import {
  type AccessorName,
  type ModelName,
  toAccessor,
  toModelName,
} from '@template/db/utils/modelNames';

export type { Identifier } from '@inixiative/prisma-map';

const models = prismaMap.models as unknown as PrismaMap;

export type RelationInfo = {
  relationName: string;
  targetModel: ModelName;
  targetAccessor: AccessorName;
  foreignKey: Identifier | null;
  isRequired: boolean;
};

// List a model's relations with the target's PascalCase model name + camelCase
// accessor, the foreign key collapsed for lookup, and whether the relation is
// required. Thin typed wrapper over
// `@inixiative/prisma-map`'s `getRelations` (which is string-keyed).
export const getModelRelations = (modelName: ModelName): RelationInfo[] =>
  getRelations(models, modelName).map((relation) => ({
    relationName: relation.relationName,
    targetModel: toModelName(relation.targetModel),
    targetAccessor: toAccessor(relation.targetModel),
    foreignKey: relation.foreignKey,
    isRequired: models[modelName].fields[relation.relationName].isRequired,
  }));

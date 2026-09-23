/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 */
import { type Annotations, getRelations, type Identifier, type PrismaMap } from '@inixiative/prisma-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { type AccessorName, type ModelName, toAccessor, toModelName } from '@template/db/utils/modelNames';

export type { Identifier } from '@inixiative/prisma-map';

const models = prismaMap.models as unknown as PrismaMap;

export type RelationInfo = {
  relationName: string;
  targetModel: ModelName;
  targetAccessor: AccessorName;
  foreignKey: Identifier | null;
  annotations: Annotations | undefined;
};

export const getModelRelations = (modelName: ModelName): RelationInfo[] =>
  getRelations(models, modelName).map((relation) => ({
    relationName: relation.relationName,
    targetModel: relation.targetModel as ModelName,
    targetAccessor: toAccessor(relation.targetModel as ModelName),
    foreignKey: relation.foreignKey,
    annotations: relation.annotations,
  }));

export const getAccessorRelations = (accessor: AccessorName): RelationInfo[] => {
  const modelName = toModelName(accessor);
  if (!modelName) throw new Error(`Unknown accessor: ${accessor}`);
  return getModelRelations(modelName);
};

/** `/// @permissions(hydrate: false)` on a relation keeps it out of the permissions tree. */
export const isPermissionEdge = (relation: RelationInfo): boolean =>
  relation.annotations?.permissions?.hydrate !== false;

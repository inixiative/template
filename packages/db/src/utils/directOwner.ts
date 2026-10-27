/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import {
  type AccessorName,
  isModelName,
  type ModelName,
  toModelName,
} from '@template/db/utils/modelNames';
import { getAccessorRelations } from '@template/db/utils/prismaMapRelations';

const tenantsNearestFirst: ModelName[] = ['Space', 'Organization'];

const ownerId = (
  child: AccessorName,
  ownerModel: ModelName,
  record: Record<string, unknown>,
): { accessor: AccessorName; id: string } | null => {
  const relations = getAccessorRelations(child).filter(
    (relation) => relation.targetModel === ownerModel && relation.foreignKey,
  );
  const [relation] = relations;
  if (relations.length !== 1 || !relation?.foreignKey) return null;
  const { foreignKey } = relation;
  const loaded = record[relation.relationName] as { id?: unknown } | null | undefined;
  const id =
    typeof foreignKey === 'string'
      ? record[foreignKey]
      : foreignKey.id
        ? record[foreignKey.id]
        : loaded?.id;
  return typeof id === 'string' ? { accessor: relation.targetAccessor, id } : null;
};

export const directOwner = (
  child: AccessorName,
  record: Record<string, unknown>,
): { accessor: AccessorName; id: string } | null => {
  const axis = getPolymorphismConfig(toModelName(child))?.axes.find(
    (candidate) => candidate.field === 'ownerModel',
  );
  if (axis) {
    const ownerModel = record.ownerModel;
    return typeof ownerModel === 'string' && isModelName(ownerModel)
      ? ownerId(child, ownerModel, record)
      : null;
  }
  for (const tenant of tenantsNearestFirst) {
    const owner = ownerId(child, tenant, record);
    if (owner) return owner;
  }
  return null;
};

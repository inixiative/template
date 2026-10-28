/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import { type AccessorName, toModelName } from '@template/db/utils/modelNames';
import { getAccessorRelations, type RelationInfo } from '@template/db/utils/prismaMapRelations';

const ownerRelation = (child: AccessorName, ownerAccessor: AccessorName): RelationInfo | null => {
  const relations = getAccessorRelations(child).filter(
    (relation) => relation.targetAccessor === ownerAccessor && relation.foreignKey,
  );
  return relations.length === 1 ? (relations[0] ?? null) : null;
};

const ownerAxis = (child: AccessorName, ownerAccessor: AccessorName) => {
  const config = getPolymorphismConfig(toModelName(child));
  if (!config) return undefined;
  const ownerModel = toModelName(ownerAccessor);
  return config.axes.find((candidate) => candidate.fkMap[ownerModel]) ?? null;
};

export const ownerColumns = (
  child: AccessorName,
  ownerAccessor: AccessorName,
  owner: Record<string, unknown>,
): Record<string, string> | null => {
  const relation = ownerRelation(child, ownerAccessor);
  if (!relation?.foreignKey) return null;
  const { foreignKey } = relation;
  const keys: Record<string, string> =
    typeof foreignKey === 'string'
      ? { [foreignKey]: owner.id as string }
      : Object.fromEntries(
          Object.entries(foreignKey).map(([ownerField, childField]) => [
            childField,
            owner[ownerField] as string,
          ]),
        );

  const axis = ownerAxis(child, ownerAccessor);
  if (axis === undefined) return keys;
  if (!axis) return null;
  return { [axis.field]: toModelName(ownerAccessor), ...keys };
};

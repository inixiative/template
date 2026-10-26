/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { HydratedRecord } from '@template/db/hydrate/types';
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import { type AccessorName, toModelName } from '@template/db/utils/modelNames';
import { getAccessorRelations } from '@template/db/utils/prismaMapRelations';

export const ownerRef = (
  child: AccessorName,
  ownerAccessor: AccessorName,
  owner: Record<string, unknown>,
): HydratedRecord => {
  const ownerModel = toModelName(ownerAccessor);
  const relations = getAccessorRelations(child).filter(
    (relation) => relation.targetAccessor === ownerAccessor && relation.foreignKey,
  );
  const [relation] = relations;
  if (relations.length !== 1 || !relation?.foreignKey)
    throw new Error(`${child} has no single relation to its owner ${ownerAccessor}`);
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

  const config = getPolymorphismConfig(toModelName(child));
  if (!config) return { id: '', ...keys };
  const axis = config.axes.find((candidate) => candidate.fkMap[ownerModel]);
  if (!axis) throw new Error(`${child} cannot be owned by ${ownerModel}`);
  return { id: '', [axis.field]: ownerModel, ...keys };
};

/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { isArmColumns } from '@template/db/registries/polymorphicIs';
import type { ModelName } from '@template/db/utils/modelNames';
import { getModelRelations, type RelationInfo } from '@template/db/utils/prismaMapRelations';

type Row = Record<string, unknown>;

/** The relation an arm's key columns form: the relation to `value` on exactly those columns. */
export const polymorphicArmRelation = (
  model: ModelName,
  axisField: string,
  value: string,
): RelationInfo => {
  const relation = getModelRelations(model).find(
    ({ targetModel, foreignKey }) =>
      targetModel === value &&
      isArmColumns(
        model,
        axisField,
        value,
        typeof foreignKey === 'string' ? [foreignKey] : Object.values(foreignKey ?? {}),
      ),
  );
  if (!relation)
    throw new Error(`${model}.${axisField}=${value} has no relation on its key columns`);
  return relation;
};

const armColumns = (model: ModelName, axisField: string, value: string): Record<string, string> => {
  const { foreignKey } = polymorphicArmRelation(model, axisField, value);
  return typeof foreignKey === 'string' ? { id: foreignKey } : (foreignKey ?? {});
};

/** The columns an arm sets to point at `row`: its id, or for a composite arm the row's owner chain. */
export const polymorphicArmKeys = (
  model: ModelName,
  axisField: string,
  value: string,
  row: Row,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(armColumns(model, axisField, value)).map(([rowColumn, armColumn]) => [
      armColumn,
      row[rowColumn] as string,
    ]),
  );

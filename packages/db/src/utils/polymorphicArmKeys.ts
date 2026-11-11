/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db } from '@template/db/client';
import { polymorphicKeyColumns } from '@template/db/registries/polymorphicIs';
import { type ModelName, toModelName } from '@template/db/utils/modelNames';
import { getModelRelations, type RelationInfo } from '@template/db/utils/prismaMapRelations';

type Row = Record<string, unknown>;

/** The relation an arm's key columns form: the relation to `value` on exactly those columns. */
export const polymorphicArmRelation = (
  model: ModelName,
  axisField: string,
  value: string,
): RelationInfo => {
  const keys = polymorphicKeyColumns(model, axisField, value);
  const relation = getModelRelations(model).find(({ targetModel, foreignKey }) => {
    const columns = typeof foreignKey === 'string' ? [foreignKey] : Object.values(foreignKey ?? {});
    return (
      targetModel === value &&
      columns.length === keys.length &&
      keys.every((key) => columns.includes(key))
    );
  });
  if (!relation)
    throw new Error(`${model}.${axisField}=${value} has no relation on ${keys.join(', ')}`);
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

/** `polymorphicArmKeys` for a row known by id; only a composite arm reads the row, tombstones included. */
export const loadPolymorphicArmKeys = async (
  model: ModelName,
  axisField: string,
  value: string,
  id: string,
): Promise<Record<string, string>> => {
  if (polymorphicKeyColumns(model, axisField, value).length <= 1)
    return polymorphicArmKeys(model, axisField, value, { id });
  const row = (await db.withDeleted(() =>
    db.delegate(toModelName(value)).findUnique({ where: { id } }),
  )) as Row | null;
  if (!row) throw new Error(`${value} ${id} not found`);
  return polymorphicArmKeys(model, axisField, value, row);
};

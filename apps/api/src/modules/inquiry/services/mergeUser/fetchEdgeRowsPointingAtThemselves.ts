/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma
 */
import {
  db,
  type ModelName,
  polymorphicArmColumns,
  polymorphicKeyColumns,
  userKeyColumns,
} from '@template/db';
import {
  type PolymorphicAxis,
  polymorphismConfigForModel,
} from '@template/db/registries/falsePolymorphism';
import { modelNames } from '@template/db/utils/modelNames';
import type { Row } from '#/modules/inquiry/services/mergeUser/repoint';

const axisPairs = (axes: readonly PolymorphicAxis[]) =>
  axes.flatMap((first, index) => axes.slice(index + 1).map((second) => [first, second] as const));

const EDGE_MODELS = modelNames.flatMap((model) => {
  const pairs = axisPairs(polymorphismConfigForModel(model)?.axes ?? []);
  return model !== 'AuditLog' && pairs.length > 0 ? [{ model, pairs }] : [];
});

const pointsAtTheSameRow = (
  model: ModelName,
  row: Row,
  first: PolymorphicAxis,
  second: PolymorphicAxis,
): boolean => {
  const arm = row[first.field];
  if (typeof arm !== 'string' || arm !== row[second.field]) return false;
  if (polymorphicKeyColumns(model, first.field, arm).length === 0) return false;
  const firstColumns = polymorphicArmColumns(model, first.field, arm);
  const secondColumns = polymorphicArmColumns(model, second.field, arm);
  return Object.entries(firstColumns).every(
    ([armRowColumn, column]) =>
      row[column] != null && row[column] === row[secondColumns[armRowColumn] ?? ''],
  );
};

/** The edge rows keyed by any of `userIds` whose two ends are one record, as `Model.id` keys. */
export const fetchEdgeRowsPointingAtThemselves = async (
  userIds: string[],
): Promise<{ model: ModelName; ids: string[] }[]> => {
  const found: { model: ModelName; ids: string[] }[] = [];
  for (const { model, pairs } of EDGE_MODELS) {
    const columns = userKeyColumns(model);
    if (columns.length === 0) continue;
    const rows = (await db.delegate(model).findMany({
      where: { OR: columns.map((column) => ({ [column]: { in: userIds } })) },
    })) as Row[];
    const ids = rows
      .filter((row) =>
        pairs.some(([first, second]) => pointsAtTheSameRow(model, row, first, second)),
      )
      .map(({ id }) => id);
    if (ids.length > 0) found.push({ model, ids });
  }
  return found;
};

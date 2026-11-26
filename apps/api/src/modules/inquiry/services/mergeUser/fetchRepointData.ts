/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma
 */
import {
  armIdColumn,
  db,
  type ModelName,
  polymorphicArmColumns,
  polymorphicKeyColumns,
} from '@template/db';
import { polymorphismConfigForModel } from '@template/db/registries/falsePolymorphism';
import type { Repoint, Row } from '#/modules/inquiry/services/mergeUser/repoint';

const fetchArmRowId = async (
  arm: ModelName,
  armColumns: Record<string, string>,
  row: Record<string, unknown>,
): Promise<string | null> => {
  const where = Object.fromEntries(
    Object.entries(armColumns).map(([armRowColumn, column]) => [armRowColumn, row[column]]),
  );
  const armRow = (await db.withDeleted(() =>
    db.delegate(arm).findFirst({ where, select: { id: true } }),
  )) as { id: string } | null;
  return armRow?.id ?? null;
};

/** The write that repoints one row, with each dual polymorphism id the repoint changes. */
export const fetchRepointData = async (
  { model, column, to }: Repoint,
  row: Row,
): Promise<Record<string, unknown>> => {
  const repointed: Record<string, unknown> = { ...row, [column]: to };
  const data: Record<string, unknown> = { [column]: to };
  for (const axis of polymorphismConfigForModel(model)?.axes ?? []) {
    if (!axis.dualPolymorphismId) continue;
    const arm = String(row[axis.field]) as ModelName;
    if (!polymorphicKeyColumns(model, axis.field, arm).includes(column)) continue;
    const idColumn = armIdColumn(model, axis.field, arm);
    data[axis.dualPolymorphismId] = idColumn
      ? repointed[idColumn]
      : await fetchArmRowId(arm, polymorphicArmColumns(model, axis.field, arm), repointed);
  }
  return data;
};

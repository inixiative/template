/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db, isHardDeletedOnTombstone, type ModelName, type RuntimeDelegate, toAccessor } from '@template/db';
import { type ChildRelation, childRelations } from '#/hooks/softDeleteCascade/childRelations';

type Row = Record<string, unknown>;

const fkWhere = (child: ChildRelation, row: Row) =>
  Object.fromEntries(child.fromFields.map((from, i) => [from, row[child.toFields[i] ?? 'id']]));

const delegateFor = (model: string): RuntimeDelegate =>
  db[toAccessor(model as ModelName)] as unknown as RuntimeDelegate;

// deleteMany does not re-enter the lifecycle, so a hard delete ends the cascade: its own
// descendants must be taken first, or they are left to raw foreign keys below every policy here.
const hardDelete = async (model: string, where: Record<string, unknown>) => {
  const doomed = (await delegateFor(model).findMany({ where, select: { id: true } })) as { id: string }[];
  if (doomed.length) {
    const ids = doomed.map((row) => row.id);
    for (const child of childRelations(model)) {
      if (!isHardDeletedOnTombstone(child.model)) continue;
      const [from] = child.fromFields;
      if (child.fromFields.length === 1 && from) await hardDelete(child.model, { [from]: { in: ids } });
    }
  }
  await delegateFor(model).deleteMany({ where });
};

export const tombstoneChildren = async (model: string, row: Row) => {
  for (const child of childRelations(model)) {
    if (isHardDeletedOnTombstone(child.model)) {
      await hardDelete(child.model, fkWhere(child, row));
    } else if (child.hasDeletedAt) {
      await delegateFor(child.model).updateManyAndReturn({
        where: { ...fkWhere(child, row), deletedAt: null },
        data: { deletedAt: row.deletedAt },
      });
    }
  }
};

export const reviveChildren = async (model: string, row: Row, priorDeletedAt: unknown) => {
  for (const child of childRelations(model)) {
    if (!child.hasDeletedAt) continue;
    await delegateFor(child.model).updateManyAndReturn({
      where: { ...fkWhere(child, row), deletedAt: priorDeletedAt },
      data: { deletedAt: null },
    });
  }
};

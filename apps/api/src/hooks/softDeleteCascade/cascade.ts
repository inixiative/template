/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db, isHardDeletedOnTombstone } from '@template/db';
import { type ChildRelation, childRelations } from '#/hooks/softDeleteCascade/childRelations';

type Row = Record<string, unknown>;

const fkWhere = (child: ChildRelation, row: Row) =>
  Object.fromEntries(child.fromFields.map((from, i) => [from, row[child.toFields[i] ?? 'id']]));

// Depth-first: deleteMany is not one of the hook's actions, so a hard delete does not re-enter the
// cascade and everything below it would fall to raw FK behavior.
const hardDelete = async (model: string, where: Record<string, unknown>) => {
  const doomed = (await db.delegate(model).findMany({ where, select: { id: true } })) as {
    id: string;
  }[];
  if (doomed.length) {
    const ids = doomed.map((row) => row.id);
    for (const child of childRelations(model)) {
      if (!isHardDeletedOnTombstone(child.model)) continue;
      const [from] = child.fromFields;
      if (child.fromFields.length === 1 && from)
        await hardDelete(child.model, { [from]: { in: ids } });
    }
  }
  await db.delegate(model).deleteMany({ where });
};

export const tombstoneChildren = async (model: string, row: Row) => {
  for (const child of childRelations(model)) {
    if (isHardDeletedOnTombstone(child.model)) {
      await hardDelete(child.model, fkWhere(child, row));
    } else if (child.hasDeletedAt) {
      await db.delegate(child.model).updateManyAndReturn({
        where: { ...fkWhere(child, row), deletedAt: null },
        data: { deletedAt: row.deletedAt },
      });
    }
  }
};

export const reviveChildren = async (model: string, row: Row, priorDeletedAt: unknown) => {
  for (const child of childRelations(model)) {
    if (!child.hasDeletedAt) continue;
    await db.delegate(child.model).updateManyAndReturn({
      where: { ...fkWhere(child, row), deletedAt: priorDeletedAt },
      data: { deletedAt: null },
    });
  }
};

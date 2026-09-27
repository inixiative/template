/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db } from '@template/db';
import { type ChildRelation, childRelations } from '#/hooks/softDeleteCascade/childRelations';
import { HARD_DELETE_ON_TOMBSTONE } from '#/hooks/softDeleteCascade/hardDeleteOnTombstone';

type Row = Record<string, unknown>;

const fkWhere = (child: ChildRelation, row: Row) =>
  Object.fromEntries(child.fromFields.map((from, i) => [from, row[child.toFields[i] ?? 'id']]));

export const tombstoneChildren = async (model: string, row: Row) => {
  for (const child of childRelations(model)) {
    if (HARD_DELETE_ON_TOMBSTONE[model]?.includes(child.model)) {
      await db.delegate(child.model).deleteMany({ where: fkWhere(child, row) });
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

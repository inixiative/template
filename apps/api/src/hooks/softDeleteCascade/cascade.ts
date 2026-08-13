/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db, type ModelName, type RuntimeDelegate, toAccessor } from '@template/db';
import { type ChildRelation, childRelations } from '#/hooks/softDeleteCascade/childRelations';
import { HARD_DELETE_ON_TOMBSTONE } from '#/hooks/softDeleteCascade/hardDeleteOnTombstone';

type Row = Record<string, unknown>;

const fkWhere = (child: ChildRelation, row: Row) =>
  Object.fromEntries(child.fromFields.map((from, i) => [from, row[child.toFields[i] ?? 'id']]));

const delegateFor = (model: string): RuntimeDelegate =>
  db[toAccessor(model as ModelName)] as unknown as RuntimeDelegate;

export const tombstoneChildren = async (model: string, row: Row) => {
  for (const child of childRelations(model)) {
    if (HARD_DELETE_ON_TOMBSTONE[model]?.includes(child.model)) {
      await delegateFor(child.model).deleteMany({ where: fkWhere(child, row) });
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

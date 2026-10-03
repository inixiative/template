/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db, isHardDeletedOnTombstone } from '@template/db';
import { uniq } from 'lodash-es';
import { type ChildRelation, childRelations } from '#/hooks/softDeleteCascade/childRelations';
import { REGENERATE_ON_REVIVE } from '#/hooks/softDeleteCascade/regenerateOnRevive';

type Row = Record<string, unknown>;

// One predicate for every parent in the batch: `fk IN (...)` for a single-column relation, an OR of
// tuples for a composite one. No parent carrying a key means nothing to reach.
const fkWhere = (child: ChildRelation, rows: Row[]): Record<string, unknown> | undefined => {
  const [from] = child.fromFields;
  if (child.fromFields.length === 1 && from) {
    const keys = uniq(
      rows.map((row) => row[child.toFields[0] ?? 'id']).filter((key) => key != null),
    );
    return keys.length ? { [from]: { in: keys } } : undefined;
  }
  return {
    OR: rows.map((row) =>
      Object.fromEntries(child.fromFields.map((from, i) => [from, row[child.toFields[i] ?? 'id']])),
    ),
  };
};

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

// Every parent in `rows` shares one tombstone stamp; each child table is walked once for the batch.
export const tombstoneChildren = async (model: string, rows: Row[], deletedAt: unknown) => {
  for (const child of childRelations(model)) {
    const where = fkWhere(child, rows);
    if (!where) continue;
    if (isHardDeletedOnTombstone(child.model)) {
      await hardDelete(child.model, where);
    } else if (child.hasDeletedAt) {
      await db.delegate(child.model).updateManyAndReturn({
        where: { ...where, deletedAt: null },
        data: { deletedAt },
      });
    }
  }
};

export const reviveChildren = async (model: string, rows: Row[], priorDeletedAt: unknown) => {
  for (const child of childRelations(model)) {
    if (isHardDeletedOnTombstone(child.model)) {
      await REGENERATE_ON_REVIVE[child.model]?.(model, rows);
      continue;
    }
    const where = fkWhere(child, rows);
    if (!child.hasDeletedAt || !where) continue;
    await db.delegate(child.model).updateManyAndReturn({
      where: { ...where, deletedAt: priorDeletedAt },
      data: { deletedAt: null },
    });
  }
};

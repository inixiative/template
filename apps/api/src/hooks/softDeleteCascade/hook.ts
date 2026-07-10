/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  type ModelName,
  type RuntimeDelegate,
  registerDbHook,
  toAccessor,
} from '@template/db';
import { castArray } from 'lodash-es';
import { type ChildRelation, childRelations } from '#/hooks/softDeleteCascade/childRelations';
import { HARD_DELETE_ON_TOMBSTONE } from '#/hooks/softDeleteCascade/hardDeleteOnTombstone';

type Row = Record<string, unknown>;

const fkWhere = (child: ChildRelation, row: Row) =>
  Object.fromEntries(child.fromFields.map((from, i) => [from, row[child.toFields[i] ?? 'id']]));

const delegateFor = (model: string): RuntimeDelegate =>
  db[toAccessor(model as ModelName)] as unknown as RuntimeDelegate;

const tombstone = async (model: string, row: Row) => {
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

const revive = async (model: string, row: Row, priorDeletedAt: unknown) => {
  for (const child of childRelations(model)) {
    if (!child.hasDeletedAt) continue;
    await delegateFor(child.model).updateManyAndReturn({
      where: { ...fkWhere(child, row), deletedAt: priorDeletedAt },
      data: { deletedAt: null },
    });
  }
};

// Each cascaded write re-enters the lifecycle, so the tree walks itself: the
// whole subtree shares one tombstone timestamp, and revival restores exactly
// the rows that died with the parent — a child deleted independently keeps
// its own timestamp and stays dead. Hard-deleted relations (revocation
// registry) are gone for good; revive does not resurrect them.
export const registerSoftDeleteCascadeHook = () => {
  registerDbHook(
    'softDeleteCascade',
    '*',
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, action, args, result, previous }: HookOptions) => {
      const data = (action === DbAction.upsert ? (args as { update?: Row }).update : (args as { data?: Row }).data) as
        | Row
        | undefined;
      if (!data || !('deletedAt' in data)) return;
      if (!childRelations(model).length) return;

      const results = castArray(result) as Row[];
      const previousById = new Map((castArray(previous ?? []) as Row[]).map((row) => [row.id, row]));

      for (const row of results) {
        const prior = previousById.get(row.id);
        if (data.deletedAt === null) {
          if (prior?.deletedAt != null) await revive(model, row, prior.deletedAt);
        } else if (row.deletedAt != null && (!prior || prior.deletedAt == null)) {
          await tombstone(model, row);
        }
      }
    },
  );
};

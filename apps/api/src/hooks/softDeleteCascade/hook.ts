/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses none
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { castArray } from 'lodash-es';
import { reviveChildren, tombstoneChildren } from '#/hooks/softDeleteCascade/cascade';
import { validateDeleteBehavior } from '#/hooks/softDeleteCascade/validateDeleteBehavior';
import { hasDeletedAt, modelNames } from '#/lib/prisma/fieldMetadata';

type Row = Record<string, unknown>;

// Each cascaded write re-enters the lifecycle, so the tree walks itself: the
// whole subtree shares one tombstone timestamp, and revival restores exactly
// the rows that died with the parent — a child deleted independently keeps
// its own timestamp and stays dead. Hard-deleted relations are gone for good
// unless they are derived from the parent (REGENERATE_ON_REVIVE): a revocation
// stays revoked, a rule reference is rebuilt from the revived owner's rule.
//
// The rows of one write are grouped by stamp and cascaded as a batch, so a bulk
// tombstone of twenty parents walks each child table once, not twenty times. A
// tombstone groups by the stamp being written (one group); a revive groups by
// each row's prior stamp, which is what its children were buried with.
export const registerSoftDeleteCascadeHook = () => {
  validateDeleteBehavior();
  registerDbHook(
    'softDeleteCascade',
    modelNames().filter(hasDeletedAt),
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, action, args, result, previous }: HookOptions) => {
      const data = (
        action === DbAction.upsert
          ? (args as { update?: Row }).update
          : (args as { data?: Row }).data
      ) as Row | undefined;
      if (!data || !('deletedAt' in data)) return;

      const previousById = new Map(
        (castArray(previous ?? []) as Row[]).map((row) => [row.id, row]),
      );
      const priorStamp = (row: Row): unknown => previousById.get(row.id)?.deletedAt;

      const groups = new Map<string, { stamp: unknown; rows: Row[] }>();
      const addTo = (stamp: unknown, row: Row) => {
        const key = String(stamp);
        const group = groups.get(key) ?? { stamp, rows: [] };
        group.rows.push(row);
        groups.set(key, group);
      };

      const isReviving = data.deletedAt === null;
      for (const row of castArray(result) as Row[]) {
        if (isReviving && priorStamp(row) != null) addTo(priorStamp(row), row);
        if (!isReviving && row.deletedAt != null && priorStamp(row) == null)
          addTo(row.deletedAt, row);
      }

      for (const { stamp, rows } of groups.values()) {
        await (isReviving
          ? reviveChildren(model, rows, stamp)
          : tombstoneChildren(model, rows, stamp));
      }
    },
  );
};

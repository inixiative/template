/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses none
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { castArray } from 'lodash-es';
import { reviveChildren, tombstoneChildren } from '#/hooks/softDeleteCascade/cascade';
import { hasDeletedAt, modelNames } from '#/lib/prisma/fieldMetadata';

type Row = Record<string, unknown>;

// Each cascaded write re-enters the lifecycle, so the tree walks itself: the
// whole subtree shares one tombstone timestamp, and revival restores exactly
// the rows that died with the parent — a child deleted independently keeps
// its own timestamp and stays dead. Hard-deleted relations (revocation
// registry) are gone for good; revive does not resurrect them.
export const registerSoftDeleteCascadeHook = () => {
  registerDbHook(
    'softDeleteCascade',
    modelNames().filter(hasDeletedAt),
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, action, args, result, previous }: HookOptions) => {
      const data = (action === DbAction.upsert ? (args as { update?: Row }).update : (args as { data?: Row }).data) as
        | Row
        | undefined;
      if (!data || !('deletedAt' in data)) return;

      const results = castArray(result) as Row[];
      const previousById = new Map((castArray(previous ?? []) as Row[]).map((row) => [row.id, row]));

      for (const row of results) {
        const prior = previousById.get(row.id);
        if (data.deletedAt === null) {
          if (prior?.deletedAt != null) await reviveChildren(model, row, prior.deletedAt);
        } else if (row.deletedAt != null && (!prior || prior.deletedAt == null)) {
          await tombstoneChildren(model, row);
        }
      }
    },
  );
};

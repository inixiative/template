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
  type Prisma,
  RULE_REFERENCEABLE_MODELS,
  registerDbHook,
  resolveFalsePolymorphismRef,
} from '@template/db';
import { castArray, groupBy, keyBy, map } from 'lodash-es';
import type { HookRow } from '#/hooks/shared/hookRows';

const isLive = (row: HookRow): boolean => row.deletedAt == null;

const deletedAtStamp = (row: HookRow): number => (row.deletedAt as Date | null)?.getTime() ?? 0;

/**
 * Copies a referenced row's `deletedAt` onto the edges that name it, so a reader answers "is this
 * rule degraded" from the edge alone.
 *
 * Matched on the true-poly pair rather than the FK: an edge whose target was purged has a null FK
 * and must not be touched here — the FK being null is already its answer, and rewriting the row
 * would put a state the database produced back through the write-path invariant.
 *
 * Hard deletes never reach here. The client path is refused (`preventHardDelete`); the purge path
 * is the database's, and `ON DELETE SET NULL` is what records it.
 */
export const registerRuleReferenceReferencedHook = () => {
  registerDbHook(
    'ruleReference:referenced',
    RULE_REFERENCEABLE_MODELS,
    HookTiming.after,
    [DbAction.create, DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, previous, result }: HookOptions) => {
      const previousById = keyBy(castArray((previous ?? []) as HookRow[]), 'id');
      const flipped = castArray((result ?? []) as HookRow[]).filter((row) => {
        if (typeof row.id !== 'string') return false;
        const prior = previousById[row.id];
        return prior ? isLive(prior) !== isLive(row) : isLive(row);
      });
      if (!flipped.length) return;

      const column = resolveFalsePolymorphismRef({
        model: 'RuleReference',
        axis: 'referencedModel',
        value: model as ModelName,
      });
      if (!column) return;
      for (const [stamp, rows] of Object.entries(groupBy(flipped, deletedAtStamp))) {
        await db.ruleReference.updateManyAndReturn({
          where: {
            referencedModel: model,
            referencedId: { in: map(rows, 'id') as string[] },
            [column]: { not: null },
          } as Prisma.RuleReferenceWhereInput,
          data: { referencedDeletedAt: stamp === '0' ? null : new Date(Number(stamp)) },
        });
      }
    },
  );
};

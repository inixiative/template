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
 * Copies a target row's `deletedAt` onto the edges that name it, so a reader answers "is this
 * rule degraded" from the edge alone.
 *
 * Matched on the true-poly pair rather than the FK: an edge whose target was purged has a null FK
 * and must not be touched here — the FK being null is already its answer, and rewriting the row
 * would put a state the database produced back through the write-path invariant.
 *
 * Hard deletes never reach here. The client path is refused (`preventHardDelete`); the purge path
 * is the database's, and `ON DELETE SET NULL` is what records it.
 */
export const registerRuleReferenceTargetHook = () => {
  registerDbHook(
    'ruleReference:target',
    RULE_REFERENCEABLE_MODELS,
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, previous, result }: HookOptions) => {
      const previousById = keyBy(castArray((previous ?? []) as HookRow[]), 'id');
      const flipped = castArray((result ?? []) as HookRow[]).filter((row) => {
        if (typeof row.id !== 'string') return false;
        const prior = previousById[row.id];
        return prior !== undefined && isLive(prior) !== isLive(row);
      });
      if (!flipped.length) return;

      const column = resolveFalsePolymorphismRef({
        model: 'RuleReference',
        axis: 'targetModel',
        value: model,
      });
      if (!column) return;
      for (const [stamp, rows] of Object.entries(groupBy(flipped, deletedAtStamp))) {
        const targetDeletedAt = stamp === '0' ? null : new Date(Number(stamp));
        await db.ruleReference.updateManyAndReturn({
          where: {
            targetModel: model,
            targetId: { in: map(rows, 'id') as string[] },
            [column]: { not: null },
          } as Prisma.RuleReferenceWhereInput,
          data: { targetDeletedAt },
        });
      }
    },
  );
};

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
import type { RuleReferenceSourceModel } from '@template/db/generated/client/enums';
import { castArray, groupBy, keyBy, map } from 'lodash-es';
import { emitAppEvent } from '#/appEvents/emit';
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
const sourceIdOf = (edge: HookRow): string | null => {
  const column = resolveFalsePolymorphismRef({
    model: 'RuleReference',
    axis: 'sourceModel',
    value: edge.sourceModel as RuleReferenceSourceModel,
  });
  return column ? ((edge[column] as string | null) ?? null) : null;
};

const publishStale = async (edge: HookRow, targetDeletedAt: Date): Promise<void> => {
  const sourceId = sourceIdOf(edge);
  if (!sourceId) return;
  await emitAppEvent('ruleReference.stale', {
    sourceModel: edge.sourceModel as RuleReferenceSourceModel,
    sourceId,
    targetModel: edge.targetModel as never,
    targetId: edge.targetId as string,
    targetDeletedAt,
  });
};

export const registerRuleReferenceTargetHook = () => {
  registerDbHook(
    'ruleReference:target',
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
        axis: 'targetModel',
        value: model,
      });
      if (!column) return;
      for (const [stamp, rows] of Object.entries(groupBy(flipped, deletedAtStamp))) {
        const targetDeletedAt = stamp === '0' ? null : new Date(Number(stamp));
        const edges = await db.ruleReference.updateManyAndReturn({
          where: {
            targetModel: model,
            targetId: { in: map(rows, 'id') as string[] },
            [column]: { not: null },
          } as Prisma.RuleReferenceWhereInput,
          data: { targetDeletedAt },
        });
        if (targetDeletedAt) for (const edge of edges) await publishStale(edge, targetDeletedAt);
      }
    },
  );
};

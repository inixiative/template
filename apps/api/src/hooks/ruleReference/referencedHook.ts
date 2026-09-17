/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses feature:email
 */

import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  type ModelName,
  type Prisma,
  registerDbHook,
  resolveFalsePolymorphismRef,
} from '@template/db';
import { REFERENCEABLE_MODELS } from '@template/email/rules';
import { castArray } from 'lodash-es';
import { buildPreviousById, type HookRow } from '#/hooks/shared/hookRows';

const isLive = (row: HookRow): boolean => row.deletedAt == null;

const flippedLiveness = (result: unknown, previous: unknown): string[] => {
  const previousById = buildPreviousById(castArray((previous ?? []) as HookRow[]));
  return castArray((result ?? []) as HookRow[])
    .filter((row) => {
      if (typeof row.id !== 'string') return false;
      const prior = previousById.get(row.id);
      return prior ? isLive(prior) !== isLive(row) : isLive(row);
    })
    .map((row) => row.id as string);
};

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
    REFERENCEABLE_MODELS,
    HookTiming.after,
    [DbAction.create, DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, previous, result }: HookOptions) => {
      const rows = castArray((result ?? []) as HookRow[]);
      const flipped = flippedLiveness(result, previous);
      if (!flipped.length) return;

      const deletedAtById = new Map(rows.map((row) => [row.id as string, (row.deletedAt ?? null) as Date | null]));
      const byDeletedAt = new Map<number, string[]>();
      for (const id of flipped) {
        const at = deletedAtById.get(id) ?? null;
        const bucket = at == null ? 0 : at.getTime();
        byDeletedAt.set(bucket, [...(byDeletedAt.get(bucket) ?? []), id]);
      }

      const column = resolveFalsePolymorphismRef({
        model: 'RuleReference',
        axis: 'referencedModel',
        value: model as ModelName,
      });
      if (!column) return;
      for (const [bucket, ids] of byDeletedAt) {
        await db.ruleReference.updateManyAndReturn({
          where: {
            referencedModel: model,
            referencedId: { in: ids },
            [column]: { not: null },
          } as Prisma.RuleReferenceWhereInput,
          data: { referencedDeletedAt: bucket === 0 ? null : new Date(bucket) },
        });
      }
    },
  );
};

/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses none
 */

import {
  DbAction,
  db,
  getPolymorphismConfig,
  type HookOptions,
  HookTiming,
  type ModelName,
  polymorphicKeyColumns,
  registerDbHook,
} from '@template/db';
import { castArray, groupBy, keyBy, map, uniq } from 'lodash-es';
import type { HookRow } from '#/hooks/shared/hookRows';

// An edge row that names another row on one false-polymorphic axis and keeps a copy of that row's
// `deletedAt`: a rule's target, an entitlement's anchor.
type NamingEdge = { model: ModelName; axis: string; id: string; stamp: string };

const NAMING_EDGES: readonly NamingEdge[] = [
  { model: 'RuleReference', axis: 'targetModel', id: 'targetId', stamp: 'targetDeletedAt' },
  { model: 'Entitlement', axis: 'sourceModel', id: 'sourceId', stamp: 'sourceDeletedAt' },
];

const namedModels = (edge: NamingEdge): string[] =>
  Object.keys(
    getPolymorphismConfig(edge.model)?.axes.find((axis) => axis.field === edge.axis)?.fkMap ?? {},
  );

const isLive = (row: HookRow): boolean => row.deletedAt == null;

const deletedAtStamp = (row: HookRow): number => (row.deletedAt as Date | null)?.getTime() ?? 0;

const stampEdges = async (edge: NamingEdge, model: string, flipped: HookRow[]) => {
  const columns = polymorphicKeyColumns(edge.model, edge.axis, model);
  if (!columns.length) return;
  for (const [stamp, rows] of Object.entries(groupBy(flipped, deletedAtStamp))) {
    await db.delegate(edge.model).updateManyAndReturn({
      where: {
        [edge.axis]: model,
        [edge.id]: { in: map(rows, 'id') as string[] },
        ...Object.fromEntries(columns.map((column) => [column, { not: null }])),
      },
      data: { [edge.stamp]: stamp === '0' ? null : new Date(Number(stamp)) },
    });
  }
};

/**
 * Copies a named row's `deletedAt` onto the edges that name it, so a reader answers "is this
 * rule degraded" or "is this anchor gone" from the edge alone.
 *
 * Matched on the true-poly pair rather than the FK: an edge whose named row was purged has a null
 * FK and must not be touched here — the FK being null is already its answer, and rewriting the row
 * would put a state the database produced back through the write-path invariant.
 *
 * Hard deletes never reach here. The client path is refused (`preventHardDelete`); the purge path
 * is the database's, and `ON DELETE SET NULL` is what records it.
 */
export const registerRuleReferenceTargetHook = () => {
  registerDbHook(
    'ruleReference:target',
    uniq(NAMING_EDGES.flatMap(namedModels)),
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
      for (const edge of NAMING_EDGES) await stampEdges(edge, model, flipped);
    },
  );
};

/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { db } from '@template/db/client';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import { groupBy, map, sortBy } from 'lodash-es';

export type TargetState = { deletedAt: Date | null };

/**
 * The current state of every row the references name, locked for the rest of the transaction, so a
 * concurrent delete cannot land between reading a target and writing the edge that names it. A
 * purged or never-created row has no entry.
 *
 * Models are locked in name order, never in the order the rule lists them: two saves that name a
 * Segment and a Tag in opposite orders would otherwise each hold one and wait on the other. Within
 * a model the order is already canonical — `id IN (...) FOR UPDATE` locks along the primary key.
 */
export const lockedTargetStates = async (
  references: RuleReference[],
): Promise<Map<string, TargetState>> => {
  const states = new Map<string, TargetState>();
  for (const [model, group] of sortBy(
    Object.entries(groupBy(references, 'model')),
    ([name]) => name,
  )) {
    const rows = await db.findForUpdate<{ id: string; deletedAt?: Date | null }>(model, {
      id: { in: [...new Set(map(group, 'id'))] },
    });
    for (const row of rows)
      states.set(referenceKey({ model, id: row.id }), { deletedAt: row.deletedAt ?? null });
  }
  return states;
};

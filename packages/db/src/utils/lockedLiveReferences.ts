/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { db } from '@template/db/client';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import { groupBy, map, sortBy } from 'lodash-es';

/**
 * The references that resolve to a live row, with those rows locked for the rest of the
 * transaction — the save gate's fence, so a concurrent delete cannot land between the check and
 * the edge it admits. Absence is the answer: never created and soft deleted both fail closed.
 *
 * Models are locked in name order, never in the order the rule lists them: two saves that name a
 * Segment and a Tag in opposite orders would otherwise each hold one and wait on the other. Within
 * a model the order is already canonical — `id IN (...) FOR UPDATE` locks along the primary key.
 */
export const lockedLiveReferences = async (references: RuleReference[]): Promise<Set<string>> => {
  const live = new Set<string>();
  for (const [model, group] of sortBy(
    Object.entries(groupBy(references, 'model')),
    ([name]) => name,
  )) {
    const rows = await db.findForUpdate<{ id: string; deletedAt: Date | null }>(model, {
      id: { in: [...new Set(map(group, 'id'))] },
    });
    for (const row of rows)
      if (row.deletedAt == null) live.add(referenceKey({ model, id: row.id }));
  }
  return live;
};

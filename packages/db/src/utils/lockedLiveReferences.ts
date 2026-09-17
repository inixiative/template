/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { db } from '@template/db/client';
import type { ModelName } from '@template/db/utils/modelNames';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import { groupBy, map } from 'lodash-es';

/**
 * The references that resolve to a live row, with those rows locked for the rest of the
 * transaction — the save gate's fence, so a concurrent delete cannot land between the check and
 * the edge it admits. Absence is the answer: never created and soft deleted both fail closed.
 */
export const lockedLiveReferences = async (references: RuleReference[]): Promise<Set<string>> => {
  const live = new Set<string>();
  for (const [model, group] of Object.entries(groupBy(references, 'model'))) {
    const rows = await db.findForUpdate<{ id: string; deletedAt: Date | null }>(model as ModelName, {
      id: { in: [...new Set(map(group, 'id'))] },
    });
    for (const row of rows) if (row.deletedAt == null) live.add(referenceKey({ model, id: row.id }));
  }
  return live;
};

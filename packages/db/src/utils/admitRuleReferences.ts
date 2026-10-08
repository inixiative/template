/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import type { SourceQuery } from '@inixiative/json-rules';
import { db } from '@template/db/client';
import { sourceQueryWhere } from '@template/db/utils/sourceQueryWhere';
import type { RuleReference } from '@template/shared/rules';
import { groupBy, partition } from 'lodash-es';

export type RuleReferenceAdmission = { admitted: RuleReference[]; unadmitted: RuleReference[] };

/** Which references the lens's own sources admit right now — the one predicate save and preflight share. */
export const admitRuleReferences = async (
  sources: SourceQuery[],
  references: RuleReference[],
): Promise<RuleReferenceAdmission> => {
  const admitted: RuleReference[] = [];
  const unadmitted: RuleReference[] = [];
  for (const [model, refs] of Object.entries(groupBy(references, 'model'))) {
    const source = sources.find((query) => query.model === model && query.field === 'id');
    if (!source) {
      unadmitted.push(...refs);
      continue;
    }
    const delegate = db.delegate(model);
    const rows = (await delegate.findMany({
      where: { AND: [await sourceQueryWhere(source), { id: { in: refs.map((ref) => ref.id) } }] },
    })) as { id: string }[];
    const ids = new Set(rows.map((row) => row.id));
    const [inside, outside] = partition(refs, (ref) => ids.has(ref.id));
    admitted.push(...inside);
    unadmitted.push(...outside);
  }
  return { admitted, unadmitted };
};

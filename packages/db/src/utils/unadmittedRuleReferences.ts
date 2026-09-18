/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import type { SourceQuery } from '@inixiative/json-rules';
import { db } from '@template/db/client';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { type ModelName, toAccessor } from '@template/db/utils/modelNames';
import type { RuleReference } from '@template/shared/rules';
import { groupBy } from 'lodash-es';

/** The references no source query admits: the row is outside the lens's eligibility for that model's id. */
export const unadmittedRuleReferences = async (
  sources: SourceQuery[],
  references: RuleReference[],
): Promise<RuleReference[]> => {
  const unadmitted: RuleReference[] = [];
  for (const [model, refs] of Object.entries(groupBy(references, (ref) => ref.model))) {
    const source = sources.find((query) => query.model === model && query.field === 'id');
    if (!source) {
      unadmitted.push(...refs);
      continue;
    }
    const delegate = db[toAccessor(model as ModelName)] as unknown as RuntimeDelegate;
    const rows = (await delegate.findMany({
      where: { AND: [source.prisma.where, { id: { in: refs.map((ref) => ref.id) } }] },
    })) as { id: string }[];
    const admitted = new Set(rows.map((row) => row.id));
    unadmitted.push(...refs.filter((ref) => !admitted.has(ref.id)));
  }
  return unadmitted;
};

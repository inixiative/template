/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { type Lens, type LensNarrowing, toSourceQueries } from '@inixiative/json-rules';
import { type SourceQueryScope, sourceQueryValues } from '@template/db/utils/sourceQueryValues';
import type { RuleReference } from '@template/shared/rules';
import { groupBy, partition } from 'lodash-es';

export type RuleReferenceAdmission = { admitted: RuleReference[]; unadmitted: RuleReference[] };

export type SourceLenses = {
  lenses: (Lens | LensNarrowing)[];
  farSide?: SourceQueryScope['farSide'];
};

/** Which references the lenses' own sources admit right now — the one predicate save and preflight share. */
export const admitRuleReferences = async (
  { lenses, farSide }: SourceLenses,
  references: RuleReference[],
): Promise<RuleReferenceAdmission> => {
  const sources = lenses.flatMap((lens) => toSourceQueries(lens).map((query) => ({ query, lens })));
  const admitted: RuleReference[] = [];
  const unadmitted: RuleReference[] = [];
  for (const [model, refs] of Object.entries(groupBy(references, 'model'))) {
    const source = sources.find(({ query }) => query.model === model && query.field === 'id');
    if (!source) {
      unadmitted.push(...refs);
      continue;
    }
    const { options } = await sourceQueryValues(
      source.query,
      { lens: source.lens, farSide },
      { id: { in: refs.map((ref) => ref.id) } },
    );
    const ids = new Set(options.map((option) => option.value));
    const [inside, outside] = partition(refs, (ref) => ids.has(ref.id));
    admitted.push(...inside);
    unadmitted.push(...outside);
  }
  return { admitted, unadmitted };
};

/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { type Lens, type LensNarrowing, toSourceQueries } from '@inixiative/json-rules';
import { type SourceQueryScope, sourceQueryValues } from '@template/db/utils/sourceQueryValues';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import { groupBy } from 'lodash-es';

export type RuleReferenceAdmission = { admitted: RuleReference[]; unadmitted: RuleReference[] };

export type ReferenceScope = { lens: Lens | LensNarrowing; references: RuleReference[] };

export type ReferenceScopes = {
  scopes: ReferenceScope[];
  farSide?: SourceQueryScope['farSide'];
};

const refusedIn = async (
  { lens, references }: ReferenceScope,
  farSide: SourceQueryScope['farSide'],
): Promise<RuleReference[]> => {
  const sources = toSourceQueries(lens);
  const refused: RuleReference[] = [];
  for (const [model, refs] of Object.entries(groupBy(references, 'model'))) {
    const source = sources.find((query) => query.model === model && query.field === 'id');
    if (!source) {
      refused.push(...refs);
      continue;
    }
    const { options } = await sourceQueryValues(
      source,
      { lens, farSide },
      { id: { in: refs.map((ref) => ref.id) } },
    );
    const ids = new Set(options.map((option) => option.value));
    refused.push(...refs.filter((ref) => !ids.has(ref.id)));
  }
  return refused;
};

/** Which references each lens's own sources admit — a reference is admitted only by the lens it was named through. */
export const admitRuleReferences = async ({
  scopes,
  farSide,
}: ReferenceScopes): Promise<RuleReferenceAdmission> => {
  const refused = new Set<string>();
  for (const scope of scopes)
    for (const ref of await refusedIn(scope, farSide)) refused.add(referenceKey(ref));
  const named = new Map(
    scopes.flatMap(({ references }) => references).map((ref) => [referenceKey(ref), ref]),
  );
  const all = [...named.values()];
  return {
    admitted: all.filter((ref) => !refused.has(referenceKey(ref))),
    unadmitted: all.filter((ref) => refused.has(referenceKey(ref))),
  };
};

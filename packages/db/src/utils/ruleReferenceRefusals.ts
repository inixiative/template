/**
 * @atlas
 * @kind validator
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { db } from '@template/db/client';
import type { Prisma } from '@template/db/generated/client/client';
import { admitRuleReferences, type ReferenceScopes } from '@template/db/utils/admitRuleReferences';
import type { TargetState } from '@template/db/utils/lockedTargetStates';
import type { ModelName } from '@template/db/utils/modelNames';
import { ruleReferenceLabels } from '@template/db/utils/ruleReferenceLabels';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import { groupBy, map } from 'lodash-es';

export type RuleReferenceRefusal = RuleReference & {
  label: string;
  reason: 'deleted' | 'missing';
};

type RefusalInput = ReferenceScopes & {
  references: RuleReference[];
  source?: { model: ModelName; id: string };
  states?: Map<string, TargetState>;
};

const readStates = async (references: RuleReference[]): Promise<Map<string, TargetState>> => {
  const states = new Map<string, TargetState>();
  for (const [model, refs] of Object.entries(groupBy(references, 'model'))) {
    const rows = (await db.withDeleted(() =>
      db.delegate(model).findMany({ where: { id: { in: [...new Set(map(refs, 'id'))] } } }),
    )) as { id: string; deletedAt?: Date | null }[];
    for (const row of rows)
      states.set(referenceKey({ model, id: row.id }), { deletedAt: row.deletedAt ?? null });
  }
  return states;
};

const heldKeys = async (
  source: RefusalInput['source'],
  references: RuleReference[],
): Promise<Set<string>> => {
  if (!source || !references.length) return new Set();
  const edges = await db.ruleReference.findMany({
    where: {
      sourceModel: source.model,
      sourceId: source.id,
      targetId: { in: map(references, 'id') },
    } as Prisma.RuleReferenceWhereInput,
  });
  return new Set(edges.map((edge) => referenceKey({ model: edge.targetModel, id: edge.targetId })));
};

/**
 * The references a rule may not name: missing, soft-deleted, or outside every scope's view. A
 * reference this source already held keeps its label, since it was in view when it was saved;
 * any other is named by id alone, so a refusal never reveals what another owner's row is called.
 */
export const ruleReferenceRefusals = async ({
  references,
  scopes,
  farSide,
  source,
  states,
}: RefusalInput): Promise<RuleReferenceRefusal[]> => {
  if (!references.length) return [];
  const keys = new Set(references.map(referenceKey));
  const inScope = scopes.map(({ lens, references: scoped }) => ({
    lens,
    references: scoped.filter((ref) => keys.has(referenceKey(ref))),
  }));
  const scoped = new Set(inScope.flatMap((scope) => scope.references.map(referenceKey)));
  const unadmitted = new Set(
    (await admitRuleReferences({ scopes: inScope, farSide })).unadmitted.map(referenceKey),
  );
  const known = states ?? (await readStates(references));
  const reasonOf = (ref: RuleReference): RuleReferenceRefusal['reason'] | null => {
    const key = referenceKey(ref);
    const state = known.get(key);
    if (!state) return 'missing';
    if (state.deletedAt) return 'deleted';
    return unadmitted.has(key) || !scoped.has(key) ? 'missing' : null;
  };
  const refused = references.flatMap((ref) => {
    const reason = reasonOf(ref);
    return reason ? [{ ref, reason }] : [];
  });
  if (!refused.length) return [];
  const held = await heldKeys(
    source,
    refused.map(({ ref }) => ref),
  );
  const labels = await ruleReferenceLabels(
    map(scopes, 'lens'),
    refused.filter(({ ref }) => held.has(referenceKey(ref))).map(({ ref }) => ref),
  );
  return refused.map(({ ref, reason }) => ({
    ...ref,
    label: labels.get(referenceKey(ref)) ?? ref.id,
    reason,
  }));
};

export const describeRuleReferenceRefusals = (refusals: RuleReferenceRefusal[]): string[] =>
  refusals.map(({ model, label, reason }) => `${model} '${label}' (${reason})`);

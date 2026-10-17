/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { db } from '@template/db/client';
import type { Prisma } from '@template/db/generated/client/client';
import { resolveFalsePolymorphismRef } from '@template/db/registries/falsePolymorphism';
import { admitRuleReferences, type ReferenceScopes } from '@template/db/utils/admitRuleReferences';
import { lockedTargetStates, type TargetState } from '@template/db/utils/lockedTargetStates';
import type { ModelName } from '@template/db/utils/modelNames';
import { RuleReferenceError } from '@template/db/utils/ruleReferenceError';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import { groupBy } from 'lodash-es';

export type RuleReferenceSource = { model: ModelName; id: string };

export type RuleReferenceGate = ReferenceScopes | 'rebuild';

type Edge = {
  id: string;
  targetModel: string;
  targetId: string;
  targetDeletedAt: Date | null;
};

const fkColumn = (axis: 'sourceModel' | 'targetModel', model: string): string => {
  const column = resolveFalsePolymorphismRef({ model: 'RuleReference', axis, value: model });
  if (!column) {
    throw new Error(
      `RuleReference has no ${axis} FK for ${model} — add the column to ruleReference.prisma and PolymorphismRegistry`,
    );
  }
  return column;
};

const edgeKey = (edge: Edge): string =>
  referenceKey({ model: edge.targetModel, id: edge.targetId });

const edgeData = (source: RuleReferenceSource, ref: RuleReference, state: TargetState) => ({
  sourceModel: source.model,
  [fkColumn('sourceModel', source.model)]: source.id,
  targetModel: ref.model,
  targetId: ref.id,
  [fkColumn('targetModel', ref.model)]: ref.id,
  targetDeletedAt: state.deletedAt,
});

const stampOf = (state: TargetState | undefined): number | null =>
  state?.deletedAt ? state.deletedAt.getTime() : null;

const admit = async (
  added: RuleReference[],
  states: Map<string, TargetState>,
  gate: ReferenceScopes,
): Promise<void> => {
  const dead = added.find((ref) => {
    const target = states.get(referenceKey(ref));
    return !target || target.deletedAt;
  });
  if (dead)
    throw new RuleReferenceError(
      `rule names a ${dead.model} that does not exist or is deleted: ${dead.id}`,
    );
  const keys = new Set(added.map(referenceKey));
  const scopes = gate.scopes.map(({ lens, references }) => ({
    lens,
    references: references.filter((ref) => keys.has(referenceKey(ref))),
  }));
  const scoped = new Set(scopes.flatMap(({ references }) => references.map(referenceKey)));
  const [outside] = [
    ...added.filter((ref) => !scoped.has(referenceKey(ref))),
    ...(await admitRuleReferences({ ...gate, scopes })).unadmitted,
  ];
  if (outside)
    throw new RuleReferenceError(
      `rule names a ${outside.model} outside this source's view: ${outside.id}`,
    );
};

// Targets are read FOR UPDATE so an edge is never written live against an uncommitted delete.
export const syncRuleReferenceEdges = async (
  source: RuleReferenceSource,
  references: RuleReference[],
  gate: RuleReferenceGate,
): Promise<void> => {
  const existing = (await db.ruleReference.findMany({
    where: { [fkColumn('sourceModel', source.model)]: source.id } as Prisma.RuleReferenceWhereInput,
  })) as Edge[];

  const named = new Map(references.map((ref) => [referenceKey(ref), ref]));
  const held = new Map(
    existing.filter((edge) => named.has(edgeKey(edge))).map((edge) => [edgeKey(edge), edge]),
  );
  const added = [...named.values()].filter((ref) => !held.has(referenceKey(ref)));
  const states = named.size ? await lockedTargetStates([...named.values()]) : new Map();
  if (gate !== 'rebuild') await admit(added, states, gate);

  const toDelete = existing.filter((edge) => !named.has(edgeKey(edge)));
  if (toDelete.length)
    await db.ruleReference.deleteMany({ where: { id: { in: toDelete.map((edge) => edge.id) } } });

  const drifted = [...held.values()].filter((edge) => {
    const target = states.get(edgeKey(edge));
    return target && (edge.targetDeletedAt?.getTime() ?? null) !== stampOf(target);
  });
  for (const [stamp, group] of Object.entries(
    groupBy(drifted, (edge) => stampOf(states.get(edgeKey(edge))) ?? 0),
  )) {
    await db.ruleReference.updateManyAndReturn({
      where: { id: { in: group.map((edge) => edge.id) } },
      data: { targetDeletedAt: stamp === '0' ? null : new Date(Number(stamp)) },
    });
  }

  const toCreate = added.flatMap((ref) => {
    const target = states.get(referenceKey(ref));
    return target ? [edgeData(source, ref, target)] : [];
  });
  if (toCreate.length)
    await db.ruleReference.createManyAndReturn({
      data: toCreate as Prisma.RuleReferenceCreateManyInput[],
    });
};

/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import type { SourceQuery } from '@inixiative/json-rules';
import { db } from '@template/db/client';
import type { Prisma } from '@template/db/generated/client/client';
import { resolveFalsePolymorphismRef } from '@template/db/registries/falsePolymorphism';
import { admitRuleReferences } from '@template/db/utils/admitRuleReferences';
import { lockedTargetStates, type TargetState } from '@template/db/utils/lockedTargetStates';
import type { ModelName } from '@template/db/utils/modelNames';
import { RuleReferenceError } from '@template/db/utils/ruleReferenceError';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import { groupBy } from 'lodash-es';

export type RuleReferenceSource = { model: ModelName; id: string };

export type RuleReferenceGate = { sources: SourceQuery[] } | 'rebuild';

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
  sources: SourceQuery[],
): Promise<void> => {
  const dead = added.find((ref) => {
    const target = states.get(referenceKey(ref));
    return !target || target.deletedAt;
  });
  if (dead)
    throw new RuleReferenceError(
      `rule names a ${dead.model} that does not exist or is deleted: ${dead.id}`,
    );
  const [outside] = (await admitRuleReferences(sources, added)).unadmitted;
  if (outside)
    throw new RuleReferenceError(
      `rule names a ${outside.model} outside this source's view: ${outside.id}`,
    );
};

/**
 * Recompute one source's edges from the rows its rule names, inside the caller's transaction:
 * set-diff against the edges it holds (a kept edge keeps its id), every kept edge restamped against
 * its target's current `deletedAt`, every new edge born with it. Targets are read under
 * `FOR UPDATE`, so an edge cannot be written live against a row whose delete is uncommitted.
 *
 * The gate is the save path's: a newly named row must be live and inside the lens's `sources`
 * (a reference already held is not re-admitted, so a dead one stays editable). A `'rebuild'` — the
 * source coming back from a revive — skips it: a target that died while the source was away gets an
 * edge carrying its stamp, so the source returns degraded rather than refused. A purged target gets
 * no new edge, and the rule fails closed on it.
 */
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
  if (gate !== 'rebuild') await admit(added, states, gate.sources);

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

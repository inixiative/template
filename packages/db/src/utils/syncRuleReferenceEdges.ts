/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { db } from '@template/db/client';
import type { Prisma } from '@template/db/generated/client/client';
import { wherePolymorphicSideIsOneOf } from '@template/db/registries/wherePolymorphicSideIsOneOf';
import {
  fetchRuleReferenceTargetsDeletedAtForUpdate,
  type RuleReferenceTargetDeletedState,
} from '@template/db/utils/fetchRuleReferenceTargetsDeletedAtForUpdate';
import type { ModelName } from '@template/db/utils/modelNames';
import { polymorphicArmKeys } from '@template/db/utils/polymorphicArmKeys';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import type { ModelRow } from '@template/shared/utils/modelRow';
import { groupBy } from 'lodash-es';

export type RuleReferenceSource = ModelRow<ModelName>;

type Edge = {
  id: string;
  targetModel: string;
  targetId: string;
  targetDeletedAt: Date | null;
};

const edgeKey = (edge: Edge): string =>
  referenceKey({ model: edge.targetModel, id: edge.targetId });

const edgeData = (
  source: RuleReferenceSource,
  ref: RuleReference,
  state: RuleReferenceTargetDeletedState,
) => ({
  sourceModel: source.model,
  ...polymorphicArmKeys('RuleReference', 'sourceModel', source.model, { id: source.id }),
  targetModel: ref.model,
  ...polymorphicArmKeys('RuleReference', 'targetModel', ref.model, { id: ref.id }),
  targetDeletedAt: state.deletedAt,
});

const stampOf = (state: RuleReferenceTargetDeletedState | undefined): number | null =>
  state?.deletedAt ? state.deletedAt.getTime() : null;

// Targets are locked before the edges are written, so one is never written unstamped against an uncommitted delete.
export const syncRuleReferenceEdges = async (
  source: RuleReferenceSource,
  references: RuleReference[],
): Promise<void> => {
  const existing = (await db.ruleReference.findMany({
    where: wherePolymorphicSideIsOneOf('RuleReference', 'sourceModel', [
      source,
    ]) as Prisma.RuleReferenceWhereInput,
  })) as Edge[];

  const referenced = new Map(references.map((ref) => [referenceKey(ref), ref]));
  const held = new Map(
    existing.filter((edge) => referenced.has(edgeKey(edge))).map((edge) => [edgeKey(edge), edge]),
  );
  const added = [...referenced.values()].filter((ref) => !held.has(referenceKey(ref)));
  const states = referenced.size
    ? await fetchRuleReferenceTargetsDeletedAtForUpdate([...referenced.values()])
    : new Map();

  const toDelete = existing.filter((edge) => !referenced.has(edgeKey(edge)));
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

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
import { isSoftDeleteModel } from '@template/db/registries/softDeleteModels';
import { admitRuleReferences } from '@template/db/utils/admitRuleReferences';
import { lockedLiveReferences } from '@template/db/utils/lockedLiveReferences';
import type { ModelName } from '@template/db/utils/modelNames';
import { RuleReferenceError } from '@template/db/utils/ruleReferenceError';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import { groupBy } from 'lodash-es';

export type RuleReferenceSource = { model: ModelName; id: string };

type Edge = { id: string; targetModel: string; targetId: string };

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

type TargetState = { deletedAt: Date | null };

const edgeData = (source: RuleReferenceSource, ref: RuleReference, target: TargetState) => ({
  sourceModel: source.model,
  [fkColumn('sourceModel', source.model)]: source.id,
  targetModel: ref.model,
  targetId: ref.id,
  [fkColumn('targetModel', ref.model)]: ref.id,
  targetDeletedAt: target.deletedAt,
});

const targetStates = async (references: RuleReference[]): Promise<Map<string, TargetState>> => {
  const states = new Map<string, TargetState>();
  for (const [model, group] of Object.entries(groupBy(references, 'model'))) {
    const soft = isSoftDeleteModel(model);
    const rows = (await db.withDeleted(() =>
      db.delegate(model).findMany({
        where: { id: { in: [...new Set(group.map((ref) => ref.id))] } },
        select: { id: true, ...(soft ? { deletedAt: true } : {}) },
      }),
    )) as { id: string; deletedAt?: Date | null }[];
    for (const row of rows)
      states.set(referenceKey({ model, id: row.id }), { deletedAt: row.deletedAt ?? null });
  }
  return states;
};

/**
 * Recompute one source's edges from the rows its rules name, inside the caller's transaction. The
 * gate is delta-only and fenced: a reference already held is not re-admitted (a save may keep or drop it),
 * a newly named row must be live, and the lock stops a concurrent delete landing between the
 * check and the edge it admits.
 */
export const syncRuleReferenceEdges = async (
  source: RuleReferenceSource,
  references: RuleReference[],
  sources?: SourceQuery[],
): Promise<void> => {
  const sourceColumn = fkColumn('sourceModel', source.model);
  const existing = (await db.ruleReference.findMany({
    where: { [sourceColumn]: source.id } as Prisma.RuleReferenceWhereInput,
  })) as Edge[];
  const held = new Set(existing.map(edgeKey));

  const live = await lockedLiveReferences(references);
  const added = references.filter((ref) => !held.has(referenceKey(ref)));
  const fresh = added.find((ref) => !live.has(referenceKey(ref)));
  if (fresh)
    throw new RuleReferenceError(
      `rule names a ${fresh.model} that does not exist or is deleted: ${fresh.id}`,
    );
  if (sources) {
    const [outside] = (await admitRuleReferences(sources, added)).unadmitted;
    if (outside)
      throw new RuleReferenceError(
        `rule names a ${outside.model} outside this owner's view: ${outside.id}`,
      );
  }

  const named = new Set(references.map(referenceKey));
  const toDelete = existing.filter((edge) => !named.has(edgeKey(edge)));
  const toCreate = references
    .filter((ref) => !held.has(referenceKey(ref)))
    .map((ref) => edgeData(source, ref, { deletedAt: null }));

  if (toDelete.length)
    await db.ruleReference.deleteMany({ where: { id: { in: toDelete.map((edge) => edge.id) } } });
  if (toCreate.length)
    await db.ruleReference.createManyAndReturn({
      data: toCreate as Prisma.RuleReferenceCreateManyInput[],
    });
};

/**
 * Rebuild one source's edges from the rows its rule names today, with no admission gate: the source
 * is coming back (a revive), not being authored. A soft-deleted target gets an edge carrying its
 * `targetDeletedAt`, so a source whose target died while it was away comes back degraded rather
 * than refused. A purged target gets no edge — the client cannot write the null-FK shape only
 * SET NULL produces, and does not need to: health reads the references off the rule and the live
 * set off the edges, so a named row with no edge is never live and the rule fails closed.
 */
export const regenerateRuleReferenceEdges = async (
  source: RuleReferenceSource,
  references: RuleReference[],
): Promise<void> => {
  const sourceColumn = fkColumn('sourceModel', source.model);
  await db.ruleReference.deleteMany({
    where: { [sourceColumn]: source.id } as Prisma.RuleReferenceWhereInput,
  });

  const unique = [...new Map(references.map((ref) => [referenceKey(ref), ref])).values()];
  if (!unique.length) return;
  const states = await targetStates(unique);
  const data = unique.flatMap((ref) => {
    const target = states.get(referenceKey(ref));
    return target ? [edgeData(source, ref, target)] : [];
  });
  if (data.length)
    await db.ruleReference.createManyAndReturn({
      data: data as Prisma.RuleReferenceCreateManyInput[],
    });
};

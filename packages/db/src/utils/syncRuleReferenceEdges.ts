/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db } from '@template/db/client';
import type { Prisma } from '@template/db/generated/client/client';
import { resolveFalsePolymorphismRef } from '@template/db/registries/falsePolymorphism';
import { lockedLiveReferences, type RuleReferenceTarget } from '@template/db/utils/lockedLiveReferences';
import type { ModelName } from '@template/db/utils/modelNames';
import { RuleReferenceError } from '@template/db/utils/ruleReferenceError';
import { ruleReferenceKey } from '@template/db/utils/ruleReferenceHealth';

export type RuleReferenceOwner = { model: ModelName; id: string };

type Edge = { id: string; referencedModel: string; referencedId: string };

const fkColumn = (axis: 'ownerModel' | 'referencedModel', model: string): string => {
  const column = resolveFalsePolymorphismRef({ model: 'RuleReference', axis, value: model as ModelName });
  if (!column) {
    throw new Error(
      `RuleReference has no ${axis} FK for ${model} — add the column to ruleReference.prisma and PolymorphismRegistry`,
    );
  }
  return column;
};

const edgeKey = (edge: Edge): string => ruleReferenceKey({ model: edge.referencedModel, id: edge.referencedId });

/**
 * Recompute one owner's edges from the rows its rules name, inside the caller's transaction. The
 * gate is delta-only and fenced: a reference already held stays editable so a save can remove it,
 * a newly named row must be live, and the lock stops a concurrent delete landing between the
 * check and the edge it admits.
 */
export const syncRuleReferenceEdges = async (
  owner: RuleReferenceOwner,
  references: RuleReferenceTarget[],
): Promise<void> => {
  const ownerColumn = fkColumn('ownerModel', owner.model);
  const existing = (await db.ruleReference.findMany({
    where: { [ownerColumn]: owner.id } as Prisma.RuleReferenceWhereInput,
  })) as Edge[];
  const held = new Set(existing.map(edgeKey));

  const live = await lockedLiveReferences(references);
  const fresh = references.find((ref) => !held.has(ruleReferenceKey(ref)) && !live.has(ruleReferenceKey(ref)));
  if (fresh) throw new RuleReferenceError(`rule names a ${fresh.model} that does not exist or is deleted: ${fresh.id}`);

  const named = new Set(references.map(ruleReferenceKey));
  const toDelete = existing.filter((edge) => !named.has(edgeKey(edge)));
  const toCreate = references
    .filter((ref) => !held.has(ruleReferenceKey(ref)))
    .map((ref) => ({
      ownerModel: owner.model,
      [ownerColumn]: owner.id,
      referencedModel: ref.model,
      referencedId: ref.id,
      [fkColumn('referencedModel', ref.model)]: ref.id,
    }));

  if (toDelete.length) await db.ruleReference.deleteMany({ where: { id: { in: toDelete.map((edge) => edge.id) } } });
  if (toCreate.length)
    await db.ruleReference.createManyAndReturn({ data: toCreate as Prisma.RuleReferenceCreateManyInput[] });
};

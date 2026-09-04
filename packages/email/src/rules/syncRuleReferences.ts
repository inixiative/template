/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */

import { db, type ModelName, type Prisma, resolveFalsePolymorphismRef } from '@template/db';
import { lockedLiveReferences } from '@template/email/rules/liveReferences';
import {
  contentRuleReferences,
  type RuleLens,
  type RuleRowReference,
  referenceKey,
} from '@template/email/rules/ruleReferences';
import { contentVocabularyIssues } from '@template/email/rules/validateRuleVocabulary';

export type RuleReferenceOwner = { model: ModelName; id: string };

export class RuleReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleReferenceError';
  }
}

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

/**
 * Recompute one owner's edges from the rule-bearing content it was just saved with. Called by the
 * save path inside its transaction; there is no hook, so a writer that does not call this has no
 * edges and its rules cannot be judged.
 */
export const syncRuleReferences = async (
  owner: RuleReferenceOwner,
  contents: string[],
  lens: RuleLens,
): Promise<void> => {
  const issues = contentVocabularyIssues(lens, ...contents);
  if (issues.length)
    throw new RuleReferenceError(`${owner.model} ${owner.id}: rule outside the lens vocabulary — ${issues[0]}`);

  const { references, dynamic } = contentRuleReferences(lens, ...contents);
  if (dynamic) {
    throw new RuleReferenceError(
      `${owner.model} ${owner.id}: a rule reads a referenced row from path or bind, or describes it without naming it — name the row instead`,
    );
  }

  const ownerColumn = fkColumn('ownerModel', owner.model);
  const existing = (await db.ruleReference.findMany({
    where: { [ownerColumn]: owner.id } as Prisma.RuleReferenceWhereInput,
  })) as Edge[];
  const held = new Map(
    existing.map((edge) => [referenceKey({ model: edge.referencedModel, id: edge.referencedId }), edge]),
  );

  // why: the gate is delta-only and fenced — a reference already held stays editable so a save can
  // why: remove it, and the lock stops a concurrent delete landing between this check and the edge.
  const live = await lockedLiveReferences(references);
  const fresh = references.find((ref) => !held.has(referenceKey(ref)) && !live.has(referenceKey(ref)));
  if (fresh) throw new RuleReferenceError(`rule names a ${fresh.model} that does not exist or is deleted: ${fresh.id}`);

  const named = new Set(references.map(referenceKey));
  const toDelete = existing.filter(
    (edge) => !named.has(referenceKey({ model: edge.referencedModel, id: edge.referencedId })),
  );
  const toCreate = references
    .filter((ref: RuleRowReference) => !held.has(referenceKey(ref)))
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

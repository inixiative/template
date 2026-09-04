/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses feature:email
 */
import { db, type ModelName, type Prisma } from '@template/db';
import {
  contentRuleReferences,
  contentVocabularyIssues,
  lockedLiveReferences,
  type RuleRowReference,
  referenceKey,
} from '@template/email/rules';
import { ownerKey, RULE_REFERENCE_SURFACES, referencedKey } from '#/hooks/ruleReference/surfaces';
import { makeError } from '#/lib/errors';

export type OwnerRow = Record<string, unknown> & { id: string };

type Edge = Record<string, unknown> & { id: string; referencedModel: string; referencedId: string };

const surfaceColumns = (model: ModelName): readonly string[] => RULE_REFERENCE_SURFACES[model]?.columns ?? [];

const contentsOf = (model: ModelName, row: OwnerRow): string[] =>
  surfaceColumns(model).map((column) => String(row[column] ?? ''));

export const referencesOf = (model: ModelName, row: OwnerRow) => contentRuleReferences(...contentsOf(model, row));

export const syncRuleReferences = async (model: ModelName, rows: OwnerRow[]): Promise<void> => {
  const key = ownerKey(model);

  const desired = new Map<string, RuleRowReference[]>();
  for (const row of rows) {
    const contents = contentsOf(model, row);
    const issues = contentVocabularyIssues(...contents);
    if (issues.length) {
      throw makeError({ status: 422, message: `${model} ${row.id}: rule outside the lens vocabulary — ${issues[0]}` });
    }
    const { references, dynamic } = contentRuleReferences(...contents);
    if (dynamic) {
      throw makeError({
        status: 422,
        message: `${model} ${row.id}: a rule reads a referenced row from path or bind, or describes it without naming it — name the row instead`,
      });
    }
    desired.set(row.id, references);
  }

  const existing = (await db.ruleReference.findMany({
    where: { [key]: { in: rows.map((row) => row.id) } } as Prisma.RuleReferenceWhereInput,
  })) as Edge[];
  const existingByOwner = new Map<string, Map<string, Edge>>();
  for (const edge of existing) {
    const owner = String(edge[key]);
    const reference = { model: edge.referencedModel, id: edge.referencedId };
    const edges = existingByOwner.get(owner) ?? new Map<string, Edge>();
    edges.set(referenceKey(reference), edge);
    existingByOwner.set(owner, edges);
  }

  // why: the gate is delta-only and fenced — a reference already held stays editable so a save can
  // why: remove it, and the lock stops a concurrent delete landing between this check and the edge.
  const live = await lockedLiveReferences([...desired.values()].flat());

  for (const [owner, references] of desired) {
    const held = existingByOwner.get(owner);
    const fresh = references.find((ref) => !held?.has(referenceKey(ref)) && !live.has(referenceKey(ref)));
    if (fresh) {
      throw makeError({
        status: 422,
        message: `rule names a ${fresh.model} that does not exist or is deleted: ${fresh.id}`,
      });
    }
  }

  const toDelete: string[] = [];
  const toCreate: Record<string, unknown>[] = [];
  for (const [owner, references] of desired) {
    const named = new Set(references.map(referenceKey));
    for (const [heldKey, edge] of existingByOwner.get(owner) ?? []) {
      if (!named.has(heldKey)) toDelete.push(edge.id);
    }
    for (const reference of references) {
      if (existingByOwner.get(owner)?.has(referenceKey(reference))) continue;
      toCreate.push({
        ownerModel: model,
        [key]: owner,
        referencedModel: reference.model,
        referencedId: reference.id,
        [referencedKey(reference.model)]: reference.id,
      });
    }
  }

  if (toDelete.length) await db.ruleReference.deleteMany({ where: { id: { in: toDelete } } });
  if (toCreate.length) {
    await db.ruleReference.createManyAndReturn({ data: toCreate as Prisma.RuleReferenceCreateManyInput[] });
  }
};

/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses feature:email
 */
import { db, type ModelName, type Prisma, type RuntimeDelegate, toAccessor } from '@template/db';
import { contentRuleReferences, type RuleRowReference, referenceKey } from '@template/email/rules';
import { isEqual } from 'lodash-es';
import { ownerKey, RULE_REFERENCE_SURFACES, referencedKey } from '#/hooks/ruleReference/surfaces';
import { makeError } from '#/lib/errors';

export type OwnerRow = Record<string, unknown> & { id: string; degradedRuleRefs: string[] };

type Edge = Record<string, unknown> & { id: string; referencedModel: string };

const delegate = (model: string): RuntimeDelegate => db[toAccessor(model as ModelName)] as unknown as RuntimeDelegate;

export const referencesOf = (model: ModelName, row: OwnerRow) => {
  const columns = RULE_REFERENCE_SURFACES[model]?.columns ?? [];
  return contentRuleReferences(...columns.map((column) => String(row[column] ?? '')));
};

export const liveReferences = async (references: RuleRowReference[]): Promise<Set<string>> => {
  const idsByModel = new Map<string, Set<string>>();
  for (const reference of references) {
    idsByModel.set(reference.model, (idsByModel.get(reference.model) ?? new Set()).add(reference.id));
  }
  const live = new Set<string>();
  for (const [model, ids] of idsByModel) {
    const rows = (await delegate(model).findMany({ where: { id: { in: [...ids] }, deletedAt: null } })) as {
      id: string;
    }[];
    for (const row of rows) live.add(referenceKey({ model, id: row.id }));
  }
  return live;
};

const writeDegraded = async (model: ModelName, row: OwnerRow, degraded: string[]): Promise<void> => {
  if (isEqual([...row.degradedRuleRefs].sort(), degraded)) return;
  await delegate(model).update({ where: { id: row.id }, data: { degradedRuleRefs: degraded } });
};

export const reresolveDegraded = async (model: ModelName, rows: OwnerRow[]): Promise<void> => {
  for (const row of rows) {
    const { references } = referencesOf(model, row);
    const live = await liveReferences(references);
    const degraded = [...new Set(references.filter((ref) => !live.has(referenceKey(ref))).map((ref) => ref.id))].sort();
    await writeDegraded(model, row, degraded);
  }
};

export const syncRuleReferences = async (model: ModelName, rows: OwnerRow[]): Promise<void> => {
  const key = ownerKey(model);
  const desired = new Map<string, RuleRowReference[]>();
  for (const row of rows) {
    const { references, dynamic } = referencesOf(model, row);
    if (dynamic) {
      throw makeError({
        status: 422,
        message: `${model} ${row.id}: a rule reads a referenced row from path or bind — name the row instead`,
      });
    }
    desired.set(row.id, references);
  }

  const all = [...desired.values()].flat();
  const live = await liveReferences(all);
  const missing = all.find((ref) => !live.has(referenceKey(ref)));
  if (missing) {
    throw makeError({
      status: 422,
      message: `rule names a ${missing.model} that does not exist or is deleted: ${missing.id}`,
    });
  }

  const existing = (await db.ruleReference.findMany({
    where: { [key]: { in: rows.map((row) => row.id) } } as Prisma.RuleReferenceWhereInput,
  })) as Edge[];
  const kept = new Set<string>();
  const toDelete: string[] = [];
  for (const edge of existing) {
    const owner = String(edge[key]);
    const reference = { model: edge.referencedModel, id: String(edge[referencedKey(edge.referencedModel)]) };
    const stillNamed = desired.get(owner)?.some((ref) => referenceKey(ref) === referenceKey(reference));
    if (stillNamed) kept.add(`${owner}|${referenceKey(reference)}`);
    else toDelete.push(edge.id);
  }

  const toCreate: Record<string, unknown>[] = [];
  for (const [owner, references] of desired) {
    for (const reference of references) {
      if (kept.has(`${owner}|${referenceKey(reference)}`)) continue;
      toCreate.push({
        ownerModel: model,
        [key]: owner,
        referencedModel: reference.model,
        [referencedKey(reference.model)]: reference.id,
      });
    }
  }

  if (toDelete.length) await db.ruleReference.deleteMany({ where: { id: { in: toDelete } } });
  if (toCreate.length) {
    await db.ruleReference.createManyAndReturn({ data: toCreate as Prisma.RuleReferenceCreateManyInput[] });
  }
  for (const row of rows) await writeDegraded(model, row, []);
};

/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses feature:email
 */
import { db, type ModelName, type Prisma, type RuntimeDelegate, toAccessor } from '@template/db';
import {
  contentRuleReferences,
  contentVocabularyIssues,
  type RuleRowReference,
  referenceKey,
} from '@template/email/rules';
import { isEqual } from 'lodash-es';
import { ownerKey, RULE_REFERENCE_SURFACES, referencedKey } from '#/hooks/ruleReference/surfaces';
import { makeError } from '#/lib/errors';

export type OwnerRow = Record<string, unknown> & { id: string; degradedRuleRefs: string[] | null };

type Edge = Record<string, unknown> & { id: string; referencedModel: string };
type LockedRow = Record<string, unknown> & { id: string; deletedAt: Date | null };

const delegate = (model: string): RuntimeDelegate => db[toAccessor(model as ModelName)] as unknown as RuntimeDelegate;

const surfaceColumns = (model: ModelName): readonly string[] => RULE_REFERENCE_SURFACES[model]?.columns ?? [];

const contentsOf = (model: ModelName, row: OwnerRow): string[] =>
  surfaceColumns(model).map((column) => String(row[column] ?? ''));

export const referencesOf = (model: ModelName, row: OwnerRow) => contentRuleReferences(...contentsOf(model, row));

const hydrated = async (model: ModelName, rows: OwnerRow[]): Promise<OwnerRow[]> => {
  const needed = [...surfaceColumns(model), 'degradedRuleRefs'];
  const partial = rows.filter((row) => needed.some((column) => row[column] === undefined));
  if (!partial.length) return rows;
  const fetched = (await db.withDeleted(() =>
    delegate(model).findMany({ where: { id: { in: partial.map((row) => row.id) } } }),
  )) as OwnerRow[];
  const byId = new Map(fetched.map((row) => [row.id, row]));
  return rows.map((row) => byId.get(row.id) ?? row);
};

const byModel = (references: RuleRowReference[]): Map<string, Set<string>> => {
  const idsByModel = new Map<string, Set<string>>();
  for (const reference of references) {
    idsByModel.set(reference.model, (idsByModel.get(reference.model) ?? new Set()).add(reference.id));
  }
  return idsByModel;
};

const lockedLiveReferences = async (references: RuleRowReference[]): Promise<Set<string>> => {
  const live = new Set<string>();
  for (const [model, ids] of byModel(references)) {
    const rows = await db.findForUpdate<LockedRow>(model as ModelName, { id: { in: [...ids] } });
    for (const row of rows) if (row.deletedAt == null) live.add(referenceKey({ model, id: row.id }));
  }
  return live;
};

export const liveReferences = async (references: RuleRowReference[]): Promise<Set<string>> => {
  const live = new Set<string>();
  for (const [model, ids] of byModel(references)) {
    const rows = (await delegate(model).findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
    })) as { id: string }[];
    for (const row of rows) live.add(referenceKey({ model, id: row.id }));
  }
  return live;
};

const degradedFrom = (references: RuleRowReference[], live: ReadonlySet<string>): string[] =>
  [...new Set(references.filter((ref) => !live.has(referenceKey(ref))).map(referenceKey))].sort();

const writeDegraded = async (
  model: ModelName,
  ownerId: string,
  current: string[],
  degraded: string[],
): Promise<void> => {
  if (isEqual([...current].sort(), degraded)) return;
  await db.withDeleted(() => delegate(model).update({ where: { id: ownerId }, data: { degradedRuleRefs: degraded } }));
};

export const syncRuleReferences = async (model: ModelName, rowsIn: OwnerRow[]): Promise<void> => {
  const key = ownerKey(model);
  const rows = await hydrated(model, rowsIn);

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
    const reference = { model: edge.referencedModel, id: String(edge[referencedKey(edge.referencedModel)]) };
    const edges = existingByOwner.get(owner) ?? new Map<string, Edge>();
    edges.set(referenceKey(reference), edge);
    existingByOwner.set(owner, edges);
  }

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
        [referencedKey(reference.model)]: reference.id,
      });
    }
  }

  if (toDelete.length) await db.ruleReference.deleteMany({ where: { id: { in: toDelete } } });
  if (toCreate.length) {
    await db.ruleReference.createManyAndReturn({ data: toCreate as Prisma.RuleReferenceCreateManyInput[] });
  }
  for (const row of rows) {
    await writeDegraded(model, row.id, row.degradedRuleRefs ?? [], degradedFrom(desired.get(row.id) ?? [], live));
  }
};

export const reresolveDegraded = async (model: ModelName, ownerIds: string[]): Promise<void> => {
  if (!ownerIds.length) return;
  const rows = await db.findForUpdate<OwnerRow>(model, { id: { in: [...new Set(ownerIds)] } });
  const refsByOwner = new Map(rows.map((row) => [row.id, referencesOf(model, row).references]));
  const live = await liveReferences([...refsByOwner.values()].flat());
  for (const row of rows) {
    await writeDegraded(model, row.id, row.degradedRuleRefs ?? [], degradedFrom(refsByOwner.get(row.id) ?? [], live));
  }
};

/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses feature:email
 */
import { DbAction, db, type HookOptions, HookTiming, type ModelName, type Prisma, registerDbHook } from '@template/db';
import { castArray } from 'lodash-es';
import { OWNER_MODELS, ownerRelation, REFERENCED_MODELS, referencedKey } from '#/hooks/ruleReference/surfaces';
import { type OwnerRow, reresolveDegraded } from '#/hooks/ruleReference/sync';

type Row = Record<string, unknown> & { id: string; deletedAt?: Date | null };

const flippedDeletedAt = (rows: Row[], previous: Row[]): string[] => {
  const previousById = new Map(previous.map((row) => [row.id, row]));
  return rows
    .filter((row) => (previousById.get(row.id)?.deletedAt == null) !== (row.deletedAt == null))
    .map((row) => row.id);
};

const ownersOf = async (model: string, ids: string[]): Promise<Map<ModelName, OwnerRow[]>> => {
  const include = Object.fromEntries(OWNER_MODELS.map((owner) => [ownerRelation(owner), true]));
  const edges = (await db.ruleReference.findMany({
    where: { referencedModel: model, [referencedKey(model)]: { in: ids } } as Prisma.RuleReferenceWhereInput,
    include: include as Prisma.RuleReferenceInclude,
  })) as (Record<string, unknown> & { ownerModel: string })[];

  const owners = new Map<ModelName, Map<string, OwnerRow>>();
  for (const edge of edges) {
    const ownerModel = edge.ownerModel as ModelName;
    const row = edge[ownerRelation(ownerModel)] as (OwnerRow & { deletedAt?: Date | null }) | null;
    if (!row || row.deletedAt) continue;
    const byId = owners.get(ownerModel) ?? new Map<string, OwnerRow>();
    byId.set(row.id, row);
    owners.set(ownerModel, byId);
  }
  return new Map([...owners].map(([ownerModel, byId]) => [ownerModel, [...byId.values()]]));
};

export const registerRuleReferenceDegradedHook = () => {
  registerDbHook(
    'ruleReference:degraded',
    REFERENCED_MODELS,
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, action, args, previous, result }: HookOptions) => {
      const data = action === DbAction.upsert ? (args as { update?: Row }).update : (args as { data?: Row }).data;
      if (!data || !('deletedAt' in data)) return;
      const flipped = flippedDeletedAt(castArray(result ?? []) as Row[], castArray(previous ?? []) as Row[]);
      if (!flipped.length) return;
      for (const [ownerModel, rows] of await ownersOf(model, flipped)) await reresolveDegraded(ownerModel, rows);
    },
  );
};

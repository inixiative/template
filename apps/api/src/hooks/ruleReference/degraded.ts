/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses feature:email
 */
import { DbAction, db, type HookOptions, HookTiming, type ModelName, type Prisma, registerDbHook } from '@template/db';
import { castArray } from 'lodash-es';
import { ownerKey, REFERENCED_MODELS, referencedKey } from '#/hooks/ruleReference/surfaces';
import { reresolveDegraded } from '#/hooks/ruleReference/sync';

type Row = Record<string, unknown> & { id: string; deletedAt?: Date | null };

const flippedDeletedAt = (rows: Row[], previous: Row[]): string[] => {
  const previousById = new Map(previous.map((row) => [row.id, row]));
  return rows
    .filter((row) => (previousById.get(row.id)?.deletedAt == null) !== (row.deletedAt == null))
    .map((row) => row.id);
};

const ownerIdsOf = async (model: string, ids: string[]): Promise<Map<ModelName, string[]>> => {
  const edges = (await db.ruleReference.findMany({
    where: { referencedModel: model, [referencedKey(model)]: { in: ids } } as Prisma.RuleReferenceWhereInput,
  })) as (Record<string, unknown> & { ownerModel: string })[];

  const owners = new Map<ModelName, Set<string>>();
  for (const edge of edges) {
    const ownerModel = edge.ownerModel as ModelName;
    const ownerId = edge[ownerKey(ownerModel)];
    if (typeof ownerId !== 'string') continue;
    owners.set(ownerModel, (owners.get(ownerModel) ?? new Set()).add(ownerId));
  }
  return new Map([...owners].map(([ownerModel, ids]) => [ownerModel, [...ids]]));
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
      for (const [ownerModel, ownerIds] of await ownerIdsOf(model, flipped)) {
        await reresolveDegraded(ownerModel, ownerIds);
      }
    },
  );
};

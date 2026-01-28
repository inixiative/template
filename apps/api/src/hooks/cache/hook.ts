import type { HookOptions, ManyAction, SingleAction } from '@template/db';
import { DbAction, HookTiming, type Prisma, db, registerDbHook } from '@template/db';
import { ConcurrencyType } from '@template/shared/utils';
import { fetchCacheKeys } from '#/hooks/cache/constants/cacheReference';
import { isNoOpUpdate } from '#/hooks/webhooks/utils';
import { clearCacheKey } from '#/lib/cache/clearCacheKey';

declare global {
  var inSeed: boolean | undefined;
}

const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn ||
  action === DbAction.updateManyAndReturn ||
  action === DbAction.deleteMany;

const isUpdateAction = (action: DbAction): boolean =>
  action === DbAction.update || action === DbAction.updateManyAndReturn;

export function registerClearCacheHook() {
  const actions = [
    DbAction.create,
    DbAction.update,
    DbAction.delete,
    DbAction.upsert,
    DbAction.createManyAndReturn,
    DbAction.updateManyAndReturn,
    DbAction.deleteMany,
  ];

  registerDbHook('clearCache', '*', HookTiming.after, actions, async (options: HookOptions) => {
    if (global.inSeed === true) return;

    const { model, action } = options;
    let allKeys: string[] = [];

    if (isManyAction(action)) {
      const { result, previous } = options as HookOptions & { action: ManyAction };
      const results = (result ?? []) as Record<string, unknown>[];
      const previouses = (previous ?? []) as Record<string, unknown>[];

      // Build a map of previous records by id for efficient lookup
      const previousById = new Map<string, Record<string, unknown>>();
      for (const prev of previouses) {
        if (prev.id) previousById.set(prev.id as string, prev);
      }

      for (const resultData of results) {
        const previousData = previousById.get(resultData.id as string);

        // Skip cache clear if only tracking fields changed
        if (isUpdateAction(action) && isNoOpUpdate(model, resultData, previousData)) {
          continue;
        }

        const keys = fetchCacheKeys(model as Prisma.ModelName, resultData);
        allKeys = allKeys.concat(keys);
      }
    } else {
      const { result, previous } = options as HookOptions & { action: SingleAction };
      const resultData = result as Record<string, unknown>;
      const previousData = previous as Record<string, unknown> | undefined;

      // Skip cache clear if only tracking fields changed
      if (isUpdateAction(action) && isNoOpUpdate(model, resultData, previousData)) {
        return;
      }

      allKeys = fetchCacheKeys(model as Prisma.ModelName, resultData);
    }

    if (allKeys.length === 0) return;

    // Deduplicate keys
    const uniqueKeys = [...new Set(allKeys)];

    const clearKeys = uniqueKeys.map((key) => async () => {
      await clearCacheKey(key);
    });

    db.onCommit(clearKeys, ConcurrencyType.redis);
  });
}

/**
 * @atlas
 * @kind handler
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import type { HookOptions, ManyAction, SingleAction } from '@template/db';
import { clearKey, DbAction, db, HookTiming, type Prisma, registerDbHook } from '@template/db';
import { ConcurrencyType } from '@template/shared/utils';
import { fetchCacheKeys } from '#/hooks/cache/constants/cacheReference';
import { isNoOpUpdate } from '#/hooks/isNoOpUpdate';

const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn || action === DbAction.updateManyAndReturn || action === DbAction.deleteMany;

const isUpdateAction = (action: DbAction): boolean =>
  action === DbAction.update || action === DbAction.updateManyAndReturn;

export const registerClearCacheHook = () => {
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
    const { model, action } = options;
    const keys = new Set<string>();
    const collect = (record: Record<string, unknown>) => {
      for (const key of fetchCacheKeys(model as Prisma.ModelName, record)) keys.add(key);
    };

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

        if (isUpdateAction(action) && isNoOpUpdate(model, resultData, previousData)) continue;

        collect(resultData);
        if (previousData) collect(previousData);
      }
    } else {
      const { result, previous } = options as HookOptions & { action: SingleAction };
      const resultData = result as Record<string, unknown>;
      const previousData = previous as Record<string, unknown> | undefined;

      // Skip cache clear if only tracking fields changed
      if (isUpdateAction(action) && isNoOpUpdate(model, resultData, previousData)) {
        return;
      }

      collect(resultData);
      if (previousData) collect(previousData);
    }

    if (keys.size === 0) return;

    const clearKeys = [...keys].map((key) => async () => {
      await clearKey(key);
    });

    db.onCommit(clearKeys, ConcurrencyType.redis);
  });
};

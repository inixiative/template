/**
 * @atlas
 * @kind handler
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import type { HookOptions, ManyAction, SingleAction } from '@template/db';
import { clearKey, DbAction, db, HookTiming, isNoOpUpdate, NOOP_FIELDS, type Prisma, registerDbHook } from '@template/db';
import { ConcurrencyType } from '@template/shared/utils';
import { fetchCacheKeys } from '#/hooks/cache/constants/cacheReference';
import { buildPreviousById, isManyAction } from '#/hooks/shared/hookRows';

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
      const previousById = buildPreviousById(previous);

      for (const resultData of results) {
        const previousData = previousById.get(resultData.id as string);

        if (isUpdateAction(action) && isNoOpUpdate(model, resultData, previousData, NOOP_FIELDS)) continue;

        collect(resultData);
        if (previousData) collect(previousData);
      }
    } else {
      const { result, previous } = options as HookOptions & { action: SingleAction };
      const resultData = result as Record<string, unknown>;
      const previousData = previous as Record<string, unknown> | undefined;

      if (isUpdateAction(action) && isNoOpUpdate(model, resultData, previousData, NOOP_FIELDS)) {
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

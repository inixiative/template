import { DbAction, HookTiming, type Prisma, db, registerDbHook } from '@template/db';
import { fetchCacheKeys } from '#/hooks/cache/constants/cacheReference';
import { isNoOpUpdate } from '#/hooks/webhooks/utils';
import { clearCacheKey } from '#/lib/cache/clearCacheKey';

declare global {
  var inSeed: boolean | undefined;
}

export function registerClearCacheHook() {
  const actions = [DbAction.create, DbAction.update, DbAction.delete, DbAction.upsert];

  registerDbHook(
    'clearCache',
    '*',
    HookTiming.after,
    actions,
    async ({ model, action, result, previous }) => {
      if (global.inSeed === true) return;

      // Skip cache clear if only tracking fields changed (e.g., lastUsedAt, updatedAt)
      if (
        action === DbAction.update &&
        isNoOpUpdate(model, result as Record<string, unknown>, previous as Record<string, unknown>)
      ) {
        return;
      }

      const keys = fetchCacheKeys(model as Prisma.ModelName, result as Record<string, unknown>);
      if (keys.length === 0) return;

      const clearKeys = keys.map((key) => async () => {
        await clearCacheKey(key);
      });

      // Queue for after commit if in transaction, otherwise run immediately
      if (db.isInTxn()) {
        db.onCommit(clearKeys);
      } else {
        await Promise.all(clearKeys.map((fn) => fn()));
      }
    },
  );
}

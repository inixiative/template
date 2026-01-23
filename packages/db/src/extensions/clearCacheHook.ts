import { fetchCacheKeys } from './cacheReference';
import { DbAction, HookTiming, registerDbHook } from './mutationLifeCycle';
import type { Prisma } from '../generated/client/client';

// Global flag to skip cache clearing during seeding
declare global {
  var inSeed: boolean | undefined;
}

/**
 * Cache invalidation hook.
 *
 * Clears relevant cache keys after any create/update/delete mutation.
 * Uses the cacheReference mapping to determine which keys to invalidate.
 *
 * @param clearCacheKeyFn - Function to clear cache keys (injected to avoid circular deps)
 */
export function registerClearCacheHook(clearCacheKeyFn: (pattern: string) => Promise<number>) {
  const actions = [DbAction.create, DbAction.update, DbAction.delete, DbAction.upsert];

  registerDbHook(
    'clearCache',
    '*', // All models
    HookTiming.after,
    actions,
    async ({ model, result }) => {
      // Skip during seeding
      if (global.inSeed === true) return;

      const keys = fetchCacheKeys(model as Prisma.ModelName, result);

      await Promise.all(
        keys.map((key) => clearCacheKeyFn(key)),
      );
    },
  );
}

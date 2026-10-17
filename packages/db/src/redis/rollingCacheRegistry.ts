/**
 * @atlas
 * @kind registry
 * @partOf primitive:caching
 * @uses none
 */
import type { RegisteredRollingCache } from '@template/db/redis/rollingCacheTypes';

// Process-wide registry of rolling caches by name: makeRollingCache registers, the coordinator lists,
// the jobs look a cache up by the name in their payload.
const rollingCacheRegistry = new Map<string, RegisteredRollingCache>();

export const registerRollingCache = (rollingCache: RegisteredRollingCache): void => {
  if (rollingCacheRegistry.has(rollingCache.name)) {
    throw new Error(
      `Rolling cache "${rollingCache.name}" already registered. Rolling cache names must be unique.`,
    );
  }
  rollingCacheRegistry.set(rollingCache.name, rollingCache);
};

// Throws for a name nothing registered. Every name in a job payload was put there by this system, so a
// missing one is a bug to surface, not a case to skip.
export const getRollingCache = (name: string): RegisteredRollingCache => {
  const rollingCache = rollingCacheRegistry.get(name);
  if (!rollingCache) throw new Error(`Rolling cache "${name}" is not registered`);
  return rollingCache;
};

export const listRollingCaches = (): RegisteredRollingCache[] => [...rollingCacheRegistry.values()];

// For tests that define a cache of their own: the registry is process-wide, so a test removes what it
// registered, the way unregisterDbHook undoes registerDbHook.
export const unregisterRollingCache = (name: string): void => {
  rollingCacheRegistry.delete(name);
};

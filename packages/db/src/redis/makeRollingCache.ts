/**
 * @atlas
 * @kind constructor
 * @partOf primitive:caching, infrastructure:redis
 * @uses infrastructure:prisma, infrastructure:observability
 */
import { cache, upsertCache } from '@template/db/redis/cache';
import { resolveRollingCacheTargets } from '@template/db/redis/resolveRollingCacheTargets';
import { registerRollingCache } from '@template/db/redis/rollingCacheRegistry';
import {
  type AnyRollingCacheTargets,
  MIN_ROLLING_CACHE_INTERVAL_SECONDS,
  type RegisteredRollingCache,
  ROLLING_CACHE_LEAF_ATTEMPTS,
  ROLLING_CACHE_TICK_SECONDS,
  type RollingCache,
  type RollingCacheConfig,
  type RollingCacheFindManyArgs,
  type RollingCacheRefreshOptions,
  type RollingCacheTarget,
  type RollingCacheTargets,
  type RollingCacheValue,
} from '@template/db/redis/rollingCacheTypes';
import type { ModelName } from '@template/db/utils/modelNames';
import { recordDuration } from '@template/shared/telemetry';

type MakeRollingCache = {
  <
    M extends ModelName,
    const A extends RollingCacheFindManyArgs<M>,
    TValue extends RollingCacheValue,
  >(
    config: RollingCacheConfig<RollingCacheTarget<M, A>, TValue> & {
      targets: RollingCacheTargets<M, A>;
    },
  ): RollingCache<RollingCacheTarget<M, A>, TValue>;
  <TValue extends RollingCacheValue>(
    config: RollingCacheConfig<void, TValue>,
  ): RollingCache<void, TValue>;
};

type AnyConfig = RollingCacheConfig<unknown, RollingCacheValue> & {
  targets?: AnyRollingCacheTargets;
};

const isWholeAtLeast = (value: number, min: number): boolean =>
  Number.isInteger(value) && value >= min;

// A rolling cache is a value computed from stored data and kept warm by recomputing it every
// `intervalSeconds`. Its entries outlive the longest a refresh can take, every retry included, so a read
// always hits. It is the shape for "a value served fast": a table of materialized values needs
// hand-written invalidation for every way its inputs change, and a rolling cache needs none.
//
// Definitions are written inline in the module that owns the data and register themselves on import,
// the way factories do. Every module that defines one must be imported by the worker's rolling-cache
// barrel (apps/api/src/lib/rollingCaches.ts); the `rolling-cache-registered` CI rule enforces that. The
// worker schedules in three layers (coordinateRollingCaches → refreshRollingCache →
// refreshRollingCacheTarget); this module only defines a cache and how to compute, key and refresh one
// target.
//
// - Registers under `name` (unique: a second registration throws) and returns the handle.
// - `targets` is `{ model, args }`: the model's own findMany args. Each row is one target: a leaf job's
//   payload and the argument to `key` and `compute`. A cache with no selector has one target, the
//   whole system.
// - `read` serves the cached value. A cold miss (first read after a deploy, or after refreshing
//   stopped) computes through `cache`, so concurrent readers share one computation.
// - `refresh` recomputes one target and overwrites the live entry (`force`). When `signal` aborted
//   while `compute` ran (the leaf was superseded or ran past its timeout; neither can stop `compute`),
//   the late result is not written. A write that fails throws, so the leaf fails and retries instead
//   of reporting a refresh that never landed.
// - Each target's refresh is timed into `rollingCache.target`, tagged with the cache name only (keys
//   carry ids, which do not belong in metric attributes).
export const makeRollingCache = ((
  config: AnyConfig,
): RegisteredRollingCache & { read: unknown } => {
  const {
    name,
    intervalSeconds,
    key,
    compute,
    timeoutSeconds = intervalSeconds,
    ttlSeconds = intervalSeconds * (ROLLING_CACHE_LEAF_ATTEMPTS + 2),
  } = config;
  if (!isWholeAtLeast(intervalSeconds, MIN_ROLLING_CACHE_INTERVAL_SECONDS)) {
    throw new Error(
      `Rolling cache "${name}" needs a whole number of seconds of at least ${MIN_ROLLING_CACHE_INTERVAL_SECONDS}, got ${intervalSeconds}`,
    );
  }
  if (!isWholeAtLeast(timeoutSeconds, 1)) {
    throw new Error(
      `Rolling cache "${name}" needs a whole timeoutSeconds of at least 1, got ${timeoutSeconds}`,
    );
  }
  const longestRefreshSeconds =
    intervalSeconds + ROLLING_CACHE_LEAF_ATTEMPTS * timeoutSeconds + ROLLING_CACHE_TICK_SECONDS;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= longestRefreshSeconds) {
    throw new Error(
      `Rolling cache "${name}" needs ttlSeconds longer than its interval plus every leaf attempt (${longestRefreshSeconds}s), got ${ttlSeconds}`,
    );
  }

  const { targets: selector } = config;
  const targets = async (): Promise<unknown[]> =>
    selector ? resolveRollingCacheTargets(selector) : [undefined];

  const read = (target: unknown): Promise<RollingCacheValue> =>
    cache(key(target), () => compute(target), ttlSeconds);

  const refresh = async (
    target: unknown,
    { signal }: RollingCacheRefreshOptions = {},
  ): Promise<boolean> => {
    const startedAt = performance.now();
    const value = await compute(target);
    recordDuration('rollingCache.target', (performance.now() - startedAt) / 1000, {
      rollingCache: name,
    });
    if (signal?.aborted) return false;
    if (!(await upsertCache(key(target), value, { ttl: ttlSeconds, force: true }))) {
      throw new Error(`Rolling cache "${name}" failed to write ${key(target)}`);
    }
    return true;
  };

  const rollingCache = {
    name,
    intervalSeconds,
    timeoutSeconds,
    ttlSeconds,
    targets,
    key,
    read,
    refresh,
  };
  registerRollingCache(rollingCache);
  return rollingCache;
}) as MakeRollingCache;

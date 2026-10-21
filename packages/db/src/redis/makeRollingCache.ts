/**
 * @atlas
 * @kind constructor
 * @constructs rollingCache
 * @partOf primitive:caching, infrastructure:redis
 * @uses infrastructure:prisma, infrastructure:observability
 */
import {
  type CacheCheck,
  checkCache,
  singleFlightLock,
  upsertCache,
} from '@template/db/redis/cache';
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
  type RollingCacheResults,
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
    const TResults extends RollingCacheResults<RollingCacheTarget<M, A>>,
  >(
    config: RollingCacheConfig<RollingCacheTarget<M, A>, TResults> & {
      targets: RollingCacheTargets<M, A>;
    },
  ): RollingCache<RollingCacheTarget<M, A>, TResults>;
  <const TResults extends RollingCacheResults<void>>(
    config: RollingCacheConfig<void, TResults>,
  ): RollingCache<void, TResults>;
};

type AnyConfig = RollingCacheConfig<unknown, RollingCacheResults<unknown>> & {
  targets?: AnyRollingCacheTargets;
};

const isWholeAtLeast = (value: number, min: number): boolean =>
  Number.isInteger(value) && value >= min;

// The target's identity fields: the keys its `select` picks. `targetOf` copies exactly these out of a
// result's params, so a reader holding `{ id, kind }` queues the `{ id }` refresh.
const selectedFields = (selector: AnyRollingCacheTargets | undefined): string[] => {
  const select = (selector?.args as { select?: Record<string, unknown> } | undefined)?.select;
  return select ? Object.keys(select).filter((field) => select[field] === true) : [];
};

// A rolling cache is a value computed from stored data and kept warm by recomputing it every
// `intervalSeconds`. Its entries outlive the longest a refresh can take, every retry included, so a
// scheduled refresh always lands before the last value expires. It is the shape for "a value served
// fast": a table of materialized values needs hand-written invalidation for every way its inputs
// change, and a rolling cache needs none.
//
// Definitions are written inline in the module that owns the data and register themselves on import,
// the way factories do. Every module that defines one must be imported by the worker's rolling-cache
// barrel (apps/api/src/lib/rollingCaches.ts); the `rolling-cache-registered` CI rule enforces that. The
// worker schedules in three layers (coordinateRollingCaches → refreshRollingCache →
// refreshRollingCacheTarget); this module only defines a cache: its targets, its results and the job
// that writes them.
//
// - `targets` is `{ model, args }`: the model's own findMany args. Each row is one target: a leaf
//   job's payload and the argument to `compute`. A cache with no selector has one target, the whole
//   system.
// - `read(result, params)` never computes. It is `checkCache` on that result's key, fresh for one
//   scheduled refresh (interval + spread + one attempt + a tick), with `computing` taken from the
//   target's lock. Only a leaf computes; a caller that wants a miss to start one goes through
//   `checkRollingCache` in the api.
// - `refresh(target)` holds the target's single-flight lock from the start of `compute` until its last
//   write lands, so every result reads "computing", never "empty", meanwhile. It waits up to
//   `timeoutSeconds` for the lock (the usual holder is a superseded refresh that is stopping) and
//   reports false rather than computing unlocked beside another. Writes overwrite (`force`); a write
//   after `signal` aborted is dropped, and a write that fails throws so the leaf retries.
// - Each target's refresh is timed into `rollingCache.target`, tagged with the cache name only.
export const makeRollingCache = ((config: AnyConfig): RegisteredRollingCache => {
  const {
    name,
    intervalSeconds,
    results,
    compute,
    channel,
    spreadSeconds = Math.floor(intervalSeconds / 2),
    timeoutSeconds = intervalSeconds,
    ttlSeconds = intervalSeconds * (ROLLING_CACHE_LEAF_ATTEMPTS + 2),
  } = config;
  if (!isWholeAtLeast(intervalSeconds, MIN_ROLLING_CACHE_INTERVAL_SECONDS)) {
    throw new Error(
      `Rolling cache "${name}" needs a whole number of seconds of at least ${MIN_ROLLING_CACHE_INTERVAL_SECONDS}, got ${intervalSeconds}`,
    );
  }
  if (!isWholeAtLeast(spreadSeconds, 0) || spreadSeconds >= intervalSeconds) {
    throw new Error(
      `Rolling cache "${name}" needs a whole spreadSeconds from 0 up to less than its interval, got ${spreadSeconds}`,
    );
  }
  if (!isWholeAtLeast(timeoutSeconds, 1)) {
    throw new Error(
      `Rolling cache "${name}" needs a whole timeoutSeconds of at least 1, got ${timeoutSeconds}`,
    );
  }
  const longestRefreshSeconds =
    intervalSeconds +
    spreadSeconds +
    ROLLING_CACHE_LEAF_ATTEMPTS * timeoutSeconds +
    ROLLING_CACHE_TICK_SECONDS;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= longestRefreshSeconds) {
    throw new Error(
      `Rolling cache "${name}" needs ttlSeconds longer than its interval plus every leaf attempt (${longestRefreshSeconds}s), got ${ttlSeconds}`,
    );
  }
  if (Object.keys(results).length === 0) {
    throw new Error(`Rolling cache "${name}" declares no results`);
  }

  const { targets: selector } = config;
  const targets = async (): Promise<unknown[]> =>
    selector ? resolveRollingCacheTargets(selector) : [undefined];

  const targetFields = selectedFields(selector);
  const targetOf = (params: unknown): unknown => {
    if (!selector) return undefined;
    const source = params as Record<string, unknown>;
    return Object.fromEntries(targetFields.map((field) => [field, source[field]]));
  };

  const targetKey = (target: unknown): string => {
    const fields = target
      ? Object.entries(target as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      : [];
    return [name, ...fields.flatMap(([field, value]) => [field, String(value)])].join(':');
  };

  const freshForSeconds =
    intervalSeconds + spreadSeconds + timeoutSeconds + ROLLING_CACHE_TICK_SECONDS;

  const resultKey = (result: string, params: unknown): string => {
    const key = results[result];
    if (!key) throw new Error(`Rolling cache "${name}" has no result "${result}"`);
    return (key as (params: unknown) => string)(params);
  };

  const read = (result: string, params: unknown): Promise<CacheCheck<RollingCacheValue>> =>
    checkCache(resultKey(result, params), {
      freshForSeconds,
      computedUnder: targetKey(targetOf(params)),
    });

  const refresh = async (
    target: unknown,
    { signal }: RollingCacheRefreshOptions = {},
  ): Promise<boolean> => {
    const lock = singleFlightLock(targetKey(target));
    if (!(await lock.acquire({ waitMs: timeoutSeconds * 1000 }))) return false;
    try {
      const startedAt = performance.now();
      const write = async (key: string, value: RollingCacheValue): Promise<void> => {
        if (signal?.aborted) return;
        if (!(await upsertCache(key, value, { ttl: ttlSeconds, force: true }))) {
          throw new Error(`Rolling cache "${name}" failed to write ${key}`);
        }
      };
      await compute(target, { results, write, signal });
      recordDuration('rollingCache.target', (performance.now() - startedAt) / 1000, {
        rollingCache: name,
      });
      return !signal?.aborted;
    } finally {
      await lock.release();
    }
  };

  const rollingCache = {
    name,
    intervalSeconds,
    spreadSeconds,
    timeoutSeconds,
    ttlSeconds,
    channel,
    targets,
    targetKey,
    targetOf,
    results,
    read,
    refresh,
  };
  registerRollingCache(rollingCache);
  return rollingCache;
}) as MakeRollingCache;

/**
 * @atlas
 * @kind type
 * @partOf primitive:caching, infrastructure:redis
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db/generated/client/client';
import type { CacheCheck } from '@template/db/redis/cache';
import type { ModelName, ModelTypeMap } from '@template/db/utils/modelNames';

// How often the coordinator runs. It must match the `coordinateRollingCaches` cron pattern in
// packages/db/prisma/seeds/cronJob.seed.ts.
export const ROLLING_CACHE_TICK_SECONDS = 60;

// Five ticks. The coordinator starts a run when the timer would expire before the next tick, so a run
// can start up to one tick late. A shorter interval would spend more of each interval waiting for the
// coordinator than refreshing.
export const MIN_ROLLING_CACHE_INTERVAL_SECONDS = 5 * ROLLING_CACHE_TICK_SECONDS;

// How many attempts a leaf gets: the queue's default `attempts` (apps/api/src/jobs/queue.ts). A cache's
// `ttlSeconds` is validated against it, so it must move with that default.
export const ROLLING_CACHE_LEAF_ATTEMPTS = 3;

// Every target is one queued job per interval, so a selector that matches far more rows than expected
// floods the queue. Resolution fails closed above this: a partial target list would leave the missing
// targets to expire with nothing saying so.
export const MAX_ROLLING_CACHE_TARGETS = 10_000;

export type RollingCacheFindManyArgs<M extends ModelName> =
  Prisma.TypeMap['model'][M]['operations']['findMany']['args'];

// The target selector: a model and that model's own Prisma `findMany` args. Each returned row is one
// target, so `select` decides what a target carries. A row travels as the leaf job's payload through
// JSON.stringify, so select JSON-scalar columns: a BigInt throws and a Date arrives as a string.
// `distinct` is Prisma's (a real DISTINCT on Postgres).
export type RollingCacheTargets<M extends ModelName, A extends RollingCacheFindManyArgs<M>> = {
  model: M;
  args: A;
};

export type RollingCacheTarget<
  M extends ModelName,
  A extends RollingCacheFindManyArgs<M>,
> = A extends {
  select: infer S;
}
  ? {
      [K in keyof S & keyof ModelTypeMap[M] as S[K] extends true ? K : never]: ModelTypeMap[M][K];
    }
  : ModelTypeMap[M];

export type AnyRollingCacheTargets = { model: ModelName; args: object };

// Anything but null or undefined: `cache` keeps null for only a minute and reads a stored undefined as
// a miss, so either would read as empty. A cache that needs "nothing" writes an empty value of its
// shape.
export type RollingCacheValue = NonNullable<unknown>;

// A cache's outputs: each named result is a function from ONE params object to the key of one cache
// entry. The params include the target's selected fields plus whatever names the entry, so the cache
// can recover the target (`targetOf`) to queue its refresh. Typed as a method so a result may take more
// fields than the target (`{ id, kind }` for an `{ id }` target).
export type RollingCacheResults<TTarget = never> = {
  [result: string]: { key(params: TTarget): string }['key'];
};

export type RollingCacheResultParams<
  TResults extends RollingCacheResults,
  R extends keyof TResults,
> = Parameters<TResults[R]>[0];

// How `compute` stores a result: `upsertCache` with the cache's TTL, overwriting. A write after the
// refresh was aborted is dropped; a write that fails throws.
export type RollingCacheWrite = (key: string, value: RollingCacheValue) => Promise<void>;

// What `compute` gets besides its target: its own `results` (to build each key), `write`, and the
// leaf's abort `signal`. A compute that works in batches checks it between them, so a superseded
// refresh stops promptly.
export type RollingCacheComputeContext<TResults extends RollingCacheResults<never>> = {
  results: TResults;
  write: RollingCacheWrite;
  signal?: AbortSignal;
};

// One definition declares its input (`targets`: one refresh job per row), its outputs (`results`) and
// the job (`compute`: one pass over the target that writes its results). Every result of a target is
// computed by the same job under one lock: a pass that reads the same rows never becomes two caches.
// `channel` names where a target's refresh is announced.
//
// Four times. `intervalSeconds` is how often a target is refreshed. `spreadSeconds` (default: half the
// interval) is the window a branch spreads its leaves' starts across. `timeoutSeconds` (default: one
// interval) is how long one leaf attempt may run before it reports itself stuck and retries.
// `ttlSeconds` (default: ROLLING_CACHE_LEAF_ATTEMPTS + 2 intervals) is how long an entry lives. It must
// be longer than an interval plus the spread plus every attempt plus a tick, so a target whose leaf
// fails every attempt still has its last good value when the next branch tries again.
export type RollingCacheConfig<TTarget, TResults extends RollingCacheResults<TTarget>> = {
  name: string;
  intervalSeconds: number;
  spreadSeconds?: number;
  timeoutSeconds?: number;
  ttlSeconds?: number;
  results: TResults;
  compute: (target: TTarget, context: RollingCacheComputeContext<TResults>) => Promise<void>;
  channel?: (target: TTarget) => string;
};

export type RollingCacheRefreshOptions = { signal?: AbortSignal };

// The type-erased handle the registry holds and the jobs work with. A typed RollingCache is not
// assignable to it, because its functions take a narrower target. Code that walks every cache goes
// through getRollingCache / listRollingCaches. `targetKey` is the target's identity (cache name plus
// its sorted fields): the leaf job's supersede key and the lock every result reports `computing` from.
// `targetOf` recovers the target from a result's params.
export type RegisteredRollingCache = {
  name: string;
  intervalSeconds: number;
  spreadSeconds: number;
  timeoutSeconds: number;
  ttlSeconds: number;
  targets: () => Promise<unknown[]>;
  targetKey: (target: unknown) => string;
  targetOf: (params: unknown) => unknown;
  results: RollingCacheResults<unknown>;
  channel?: (target: unknown) => string;
  read: (result: string, params: unknown) => Promise<CacheCheck<RollingCacheValue>>;
  refresh: (target: unknown, options?: RollingCacheRefreshOptions) => Promise<boolean>;
};

export type RollingCache<TTarget, TResults extends RollingCacheResults<TTarget>> = Omit<
  RegisteredRollingCache,
  'targets' | 'targetKey' | 'targetOf' | 'results' | 'channel' | 'read' | 'refresh'
> & {
  targets: () => Promise<TTarget[]>;
  targetKey: (target: TTarget) => string;
  targetOf: <R extends keyof TResults & string>(
    params: RollingCacheResultParams<TResults, R>,
  ) => TTarget;
  results: TResults;
  channel?: (target: TTarget) => string;
  read: <
    TValue extends RollingCacheValue,
    R extends keyof TResults & string = keyof TResults & string,
  >(
    result: R,
    params: RollingCacheResultParams<TResults, R>,
  ) => Promise<CacheCheck<TValue>>;
  refresh: (target: TTarget, options?: RollingCacheRefreshOptions) => Promise<boolean>;
};

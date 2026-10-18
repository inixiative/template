/**
 * @atlas
 * @kind type
 * @partOf primitive:caching, infrastructure:redis
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db/generated/client/client';
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
// a miss, so either would put recomputation back on the request path. A cache that needs "nothing"
// returns an empty value of its shape.
export type RollingCacheValue = NonNullable<unknown>;

// Three separate times. `intervalSeconds` is how often a target is refreshed. `timeoutSeconds`
// (default: one interval) is how long one leaf attempt may run before it reports itself stuck and
// retries. `ttlSeconds` (default: ROLLING_CACHE_LEAF_ATTEMPTS + 2 intervals) is how long an entry lives.
// It must be longer than an interval plus every attempt plus a tick, so a target whose leaf fails every
// attempt still has its last good value when the next branch tries again. A read always hits.
export type RollingCacheConfig<TTarget, TValue extends RollingCacheValue> = {
  name: string;
  intervalSeconds: number;
  timeoutSeconds?: number;
  ttlSeconds?: number;
  key: (target: TTarget) => string;
  compute: (target: TTarget) => Promise<TValue>;
};

export type RollingCacheRefreshOptions = { signal?: AbortSignal };

// The type-erased handle the registry holds and the coordinator works with. A typed RollingCache is
// not assignable to it, because its `key` and `refresh` take a narrower target. Code that walks every
// cache goes through getRollingCache / listRollingCaches.
export type RegisteredRollingCache = {
  name: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  ttlSeconds: number;
  targets: () => Promise<unknown[]>;
  key: (target: unknown) => string;
  refresh: (target: unknown, options?: RollingCacheRefreshOptions) => Promise<boolean>;
};

export type RollingCache<TTarget, TValue extends RollingCacheValue> = Omit<
  RegisteredRollingCache,
  'targets' | 'key' | 'refresh'
> & {
  targets: () => Promise<TTarget[]>;
  key: (target: TTarget) => string;
  read: (target: TTarget) => Promise<TValue>;
  refresh: (target: TTarget, options?: RollingCacheRefreshOptions) => Promise<boolean>;
};

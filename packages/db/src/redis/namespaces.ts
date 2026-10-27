/**
 * @atlas
 * @partOf primitive:caching, primitive:jobs, primitive:websockets, feature:auth, primitive:shared, infrastructure:redis, infrastructure:prisma
 * @uses none
 */
export const redisNamespace = {
  bull: 'bull',
  cache: 'cache',
  // When the value under a cache key was written (epoch ms), set and cleared with the value itself.
  cacheWritten: 'cachewritten',
  // A cache key's generation and the cache-wide epoch. A clear moves them; a compute publishes only if
  // neither moved while it ran.
  cacheGeneration: 'cachegen',
  // A rolling-cache target whose refresh has been enqueued and has not yet taken its lock.
  cacheQueued: 'cachequeued',
  job: 'job',
  ws: 'ws',
  otp: 'otp',
  session: 'session',
  limit: 'limit',
  lock: 'lock',
  lane: 'lane',
  // A rolling cache's scheduling state (its timer), deliberately not under `cache:`: flushing cached
  // values must not reschedule the refresh.
  rollingCache: 'rollingcache',
  // flag: 'flag',
} as const;

export type RedisNamespace = (typeof redisNamespace)[keyof typeof redisNamespace];

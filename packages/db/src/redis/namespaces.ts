/**
 * @atlas
 * @partOf primitive:caching, primitive:jobs, primitive:websockets, feature:auth, primitive:shared, infrastructure:redis, infrastructure:prisma
 * @uses none
 */
export const redisNamespace = {
  bull: 'bull',
  cache: 'cache',
  job: 'job',
  ws: 'ws',
  otp: 'otp',
  session: 'session',
  limit: 'limit',
  lock: 'lock',
  // flag: 'flag',
} as const;

export type RedisNamespace = (typeof redisNamespace)[keyof typeof redisNamespace];

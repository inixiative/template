export const redisNamespace = {
  bull: 'bull',
  cache: 'cache',
  job: 'job',
  ws: 'ws',
  otp: 'otp',
  session: 'session',
  limit: 'limit',
  // flag: 'flag',
} as const;

export type RedisNamespace = (typeof redisNamespace)[keyof typeof redisNamespace];

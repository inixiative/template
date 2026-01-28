/**
 * Redis key namespaces for consistent prefixing.
 *
 * All Redis keys should be prefixed with one of these namespaces
 * to keep data organized and avoid collisions.
 *
 * Current namespaces:
 * - bull:*     - BullMQ job queues (managed by BullMQ)
 * - cache:*    - Application cache (user lookups, etc.)
 * - job:*      - Job coordination (supersede flags, singleton locks)
 * - ws:*       - WebSocket pub/sub channels
 * - otp:*      - One-time passwords / verification codes
 * - session:*  - User sessions (if not using DB sessions)
 * - limit:*    - Rate limiting counters and windows
 * - flag:*     - Feature flags (superadmin controlled)
 */
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

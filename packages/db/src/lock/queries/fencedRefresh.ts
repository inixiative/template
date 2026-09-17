/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { LockRedis } from '@template/db/lock/types';

// Refresh is one compare-and-expire eval. A GET then a separate PEXPIRE lets a key that expired
// and was re-acquired between the two calls be extended for its new holder.
const FENCED_REFRESH =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";

export const fencedRefresh = (redis: LockRedis, key: string, token: string, ttlMs: number): Promise<unknown> =>
  redis.eval(FENCED_REFRESH, 1, key, token, String(ttlMs));

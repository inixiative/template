/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { LockRedis } from '@template/db/lock/types';

// Fenced delete in one Lua eval so the key can't expire and be re-acquired between a separate
// GET and DEL — an unfenced delete would then remove the new holder's lock (steal-and-cascade).
const FENCED_DELETE =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export const fencedDelete = (redis: LockRedis, key: string, token: string): Promise<unknown> =>
  redis.eval(FENCED_DELETE, 1, key, token);

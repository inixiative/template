/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { LockRedis } from '@template/db/lock/types';

// Returns nil when this caller took the key, otherwise the holder already there — reading the
// incumbent in the same script is what stops a claim from expiring between the set and the read.
const CLAIM_ONCE =
  "if redis.call('set', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX') then return nil else return redis.call('get', KEYS[1]) end";

export const claimOnce = (
  redis: LockRedis,
  key: string,
  holder: string,
  ttlMs: number,
): Promise<unknown> => redis.eval(CLAIM_ONCE, 1, key, holder, String(ttlMs));

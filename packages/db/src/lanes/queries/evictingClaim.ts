/**
 * @atlas
 * @kind query
 * @partOf infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// Last claim wins. The TTL covers the scheduled delay plus the queue wait, because only a running holder
// refreshes its lane. The displaced holder is marked by markDisplacedHolder once the new holder exists.
const EVICTING_CLAIM = `
local previous = redis.call('get', KEYS[1])
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
return previous
`;

export const evictingClaim = async (
  redis: RedisEval,
  lane: string,
  holderId: string,
  laneTtlSec: number,
): Promise<string | null> => {
  const previous = await redis.eval(EVICTING_CLAIM, 1, lane, holderId, String(laneTtlSec));
  return typeof previous === 'string' ? previous : null;
};

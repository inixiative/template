/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// Takes the longest run of keys, in order, that are free or already this token's, and stops at the
// first key another holder has. Returns how many it took.
const FENCED_SET_PREFIX = `
local won = 0
for _, key in ipairs(KEYS) do
  local holder = redis.call('get', key)
  if holder ~= false and holder ~= ARGV[1] then
    return won
  end
  redis.call('set', key, ARGV[1], 'PX', ARGV[2])
  won = won + 1
end
return won
`;

export const fencedSetPrefix = async (
  redis: RedisEval,
  keys: readonly string[],
  token: string,
  ttlMs: number,
): Promise<number> =>
  Number(await redis.eval(FENCED_SET_PREFIX, keys.length, ...keys, token, String(ttlMs)));

/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// Extends every key that still holds this token. The reply is one '1' or '0' per key, in order.
const FENCED_REFRESH_ALL = `
local refreshed = {}
for index, key in ipairs(KEYS) do
  if redis.call('get', key) == ARGV[1] then
    redis.call('pexpire', key, ARGV[2])
    refreshed[index] = '1'
  else
    refreshed[index] = '0'
  end
end
return table.concat(refreshed)
`;

export const fencedRefreshAll = async (
  redis: RedisEval,
  keys: readonly string[],
  token: string,
  ttlMs: number,
): Promise<boolean[]> => {
  const refreshed = await redis.eval(
    FENCED_REFRESH_ALL,
    keys.length,
    ...keys,
    token,
    String(ttlMs),
  );
  if (typeof refreshed !== 'string' || refreshed.length !== keys.length) {
    throw new Error(`unexpected refresh reply: ${String(refreshed)}`);
  }
  return [...refreshed].map((flag) => flag === '1');
};

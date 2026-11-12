/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// Deletes every key that still holds this token and returns how many it deleted.
const FENCED_DELETE_ALL = `
local deleted = 0
for _, key in ipairs(KEYS) do
  if redis.call('get', key) == ARGV[1] then
    deleted = deleted + redis.call('del', key)
  end
end
return deleted
`;

export const fencedDeleteAll = async (
  redis: RedisEval,
  keys: readonly string[],
  token: string,
): Promise<number> => Number(await redis.eval(FENCED_DELETE_ALL, keys.length, ...keys, token));

/**
 * @atlas
 * @kind query
 * @partOf feature:auth
 * @uses infrastructure:redis
 */
import { redisClient, redisNamespace } from '@template/db';

const INCREMENT_WITH_TTL_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`;

export const incrementSecondaryStorageKey = async (key: string, ttl: number): Promise<number> => {
  const fullKey = `${redisNamespace.session}:${key}`;
  const result = await redisClient().eval(INCREMENT_WITH_TTL_LUA, 1, fullKey, ttl);
  return Number(result);
};

/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

const PUBLISH_IF_CURRENT = `
if redis.call('get', KEYS[4]) ~= ARGV[5] then return 0 end
local generation = redis.call('get', KEYS[2]) or '0'
if generation ~= ARGV[1] then return 0 end
redis.call('setex', KEYS[1], ARGV[2], ARGV[3])
redis.call('setex', KEYS[3], ARGV[2], ARGV[4])
return 1
`;

export const publishIfCurrent = async (
  redis: RedisEval,
  keys: { key: string; generationKey: string; writtenKey: string; lockKey: string },
  captured: string,
  holder: string,
  ttlSeconds: number,
  payload: string,
): Promise<boolean> =>
  Number(
    await redis.eval(
      PUBLISH_IF_CURRENT,
      4,
      keys.key,
      keys.generationKey,
      keys.writtenKey,
      keys.lockKey,
      captured,
      String(ttlSeconds),
      payload,
      String(Date.now()),
      holder,
    ),
  ) === 1;

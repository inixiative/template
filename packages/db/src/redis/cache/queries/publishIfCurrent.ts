/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

const PUBLISH_IF_CURRENT = `
local generation = redis.call('get', KEYS[2]) or '0'
local epoch = redis.call('get', KEYS[3]) or '0'
if generation ~= ARGV[1] or epoch ~= ARGV[2] then return 0 end
redis.call('setex', KEYS[1], ARGV[3], ARGV[4])
redis.call('setex', KEYS[4], ARGV[3], ARGV[5])
return 1
`;

export const publishIfCurrent = async (
  redis: RedisEval,
  keys: { key: string; generationKey: string; epochKey: string; writtenKey: string },
  captured: { generation: string; epoch: string },
  ttlSeconds: number,
  payload: string,
): Promise<boolean> =>
  Number(
    await redis.eval(
      PUBLISH_IF_CURRENT,
      4,
      keys.key,
      keys.generationKey,
      keys.epochKey,
      keys.writtenKey,
      captured.generation,
      captured.epoch,
      String(ttlSeconds),
      payload,
      String(Date.now()),
    ),
  ) === 1;

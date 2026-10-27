/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// Writes the value and its write time only if the key's generation and the cache epoch are the ones
// the compute captured before it read. Returns 1 when written, 0 when a clear moved either one, and 2
// when `keepExisting` found a value already there (another writer landed first).
const PUBLISH_IF_CURRENT = `
local generation = redis.call('get', KEYS[2]) or '0'
local epoch = redis.call('get', KEYS[3]) or '0'
if generation ~= ARGV[1] or epoch ~= ARGV[2] then return 0 end
if ARGV[5] == '1' then
  if redis.call('set', KEYS[1], ARGV[4], 'EX', ARGV[3], 'NX') then
    redis.call('setex', KEYS[4], ARGV[3], ARGV[6])
    return 1
  end
  return 2
end
redis.call('setex', KEYS[1], ARGV[3], ARGV[4])
redis.call('setex', KEYS[4], ARGV[3], ARGV[6])
return 1
`;

export type PublishResult = 0 | 1 | 2;

export const publishIfCurrent = async (
  redis: RedisEval,
  keys: { key: string; generationKey: string; epochKey: string; writtenKey: string },
  captured: { generation: string; epoch: string },
  ttlSeconds: number,
  payload: string,
  keepExisting: boolean,
): Promise<PublishResult> =>
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
      keepExisting ? '1' : '0',
      String(Date.now()),
    ),
  ) as PublishResult;

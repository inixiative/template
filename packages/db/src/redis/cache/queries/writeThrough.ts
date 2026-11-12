/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

const WRITE_THROUGH = `
if ARGV[6] ~= '1' and redis.call('exists', KEYS[1]) == 1 then return 0 end
redis.call('set', KEYS[2], ARGV[1], 'EX', ARGV[2])
redis.call('setex', KEYS[3], ARGV[3], ARGV[5])
redis.call('setex', KEYS[1], ARGV[3], ARGV[4])
return 1
`;

export const writeThrough = async (
  redis: RedisEval,
  keys: { key: string; generationKey: string; writtenKey: string },
  generation: { value: string; ttlSeconds: number },
  ttlSeconds: number,
  payload: string,
  force: boolean,
): Promise<boolean> =>
  Number(
    await redis.eval(
      WRITE_THROUGH,
      3,
      keys.key,
      keys.generationKey,
      keys.writtenKey,
      generation.value,
      String(generation.ttlSeconds),
      String(ttlSeconds),
      payload,
      String(Date.now()),
      force ? '1' : '0',
    ),
  ) === 1;

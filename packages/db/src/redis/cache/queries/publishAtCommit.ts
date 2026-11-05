/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

const PUBLISH_AT_COMMIT = `
local current = redis.call('get', KEYS[2]) or '0'
if ARGV[7] == '1' then
  redis.call('del', KEYS[1])
  redis.call('del', KEYS[3])
  redis.call('set', KEYS[2], ARGV[2], 'EX', ARGV[3])
end
if ARGV[5] == '' or current ~= ARGV[1] then return 0 end
redis.call('setex', KEYS[1], ARGV[4], ARGV[5])
redis.call('setex', KEYS[3], ARGV[4], ARGV[6])
return 1
`;

export const publishAtCommit = async (
  redis: RedisEval,
  keys: { key: string; generationKey: string; writtenKey: string },
  args: {
    captured: string;
    clearedGeneration: string;
    generationTtlSeconds: number;
    ttlSeconds: number;
    payload: string;
    shouldClear: boolean;
  },
): Promise<boolean> =>
  Number(
    await redis.eval(
      PUBLISH_AT_COMMIT,
      3,
      keys.key,
      keys.generationKey,
      keys.writtenKey,
      args.captured,
      args.clearedGeneration,
      String(args.generationTtlSeconds),
      String(args.ttlSeconds),
      args.payload,
      String(Date.now()),
      args.shouldClear ? '1' : '0',
    ),
  ) === 1;

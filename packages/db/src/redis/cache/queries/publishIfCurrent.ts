/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// why: KEYS[4] (lockKey) is passed by single-flight writes; batch reads omit it and guard against
// overwriting a fresher key unless repairing a corrupt payload (ARGV[5] == 'overwrite').
const PUBLISH_IF_CURRENT = `
if KEYS[4] then
  if redis.call('get', KEYS[4]) ~= ARGV[5] then return 0 end
elseif ARGV[5] ~= 'overwrite' and redis.call('exists', KEYS[1]) == 1 then
  return 0
end
local generation = redis.call('get', KEYS[2]) or '0'
if generation ~= ARGV[1] then return 0 end
redis.call('setex', KEYS[1], ARGV[2], ARGV[3])
redis.call('setex', KEYS[3], ARGV[2], ARGV[4])
return 1
`;

export const publishIfCurrent = async (
  redis: RedisEval,
  keys: { key: string; generationKey: string; writtenKey: string; lockKey?: string },
  capturedGeneration: string,
  holder: string | undefined,
  ttlSeconds: number,
  payload: string,
  overwriteExisting = false,
): Promise<boolean> => {
  const keyArgs = keys.lockKey
    ? [keys.key, keys.generationKey, keys.writtenKey, keys.lockKey]
    : [keys.key, keys.generationKey, keys.writtenKey];
  const guardArg = keys.lockKey ? (holder ?? '') : overwriteExisting ? 'overwrite' : 'absent';
  return (
    Number(
      await redis.eval(
        PUBLISH_IF_CURRENT,
        keyArgs.length,
        ...keyArgs,
        capturedGeneration,
        String(ttlSeconds),
        payload,
        String(Date.now()),
        guardArg,
      ),
    ) === 1
  );
};

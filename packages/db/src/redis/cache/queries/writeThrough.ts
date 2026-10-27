/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// A write that is itself the fresh value: it lands with its write time under one TTL, and moves the
// key's generation so a compute that read before it cannot overwrite it with an older value.
const WRITE_THROUGH = `
redis.call('set', KEYS[2], ARGV[1], 'EX', ARGV[2])
redis.call('setex', KEYS[3], ARGV[3], ARGV[5])
return redis.call('setex', KEYS[1], ARGV[3], ARGV[4])
`;

export const writeThrough = (
  redis: RedisEval,
  keys: { key: string; generationKey: string; writtenKey: string },
  generation: { value: string; ttlSeconds: number },
  ttlSeconds: number,
  payload: string,
): Promise<unknown> =>
  redis.eval(
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
  );

/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// The value and its write time land in one eval, with one TTL, so the write time is never older or
// newer than the value it describes.
const WRITE_CACHE_ENTRY = `
redis.call('setex', KEYS[2], ARGV[1], ARGV[3])
return redis.call('setex', KEYS[1], ARGV[1], ARGV[2])
`;

export const writeCacheEntry = (
  redis: RedisEval,
  { key, writtenKey }: { key: string; writtenKey: string },
  ttlSeconds: number,
  payload: string,
): Promise<unknown> =>
  redis.eval(
    WRITE_CACHE_ENTRY,
    2,
    key,
    writtenKey,
    String(ttlSeconds),
    payload,
    String(Date.now()),
  );

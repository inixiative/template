/**
 * @atlas
 * @partOf primitive:caching, infrastructure:redis, infrastructure:prisma
 * @uses infrastructure:observability
 */
import { cacheRead } from '@template/db/redis/cache/cacheRead';
import { DEFAULT_TTL } from '@template/db/redis/cache/defaultTtl';
import { withCacheSpan } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { validateKey } from '@template/db/redis/cache/validateKey';

export const cache = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number | ((value: T) => number) = DEFAULT_TTL,
): Promise<T> => {
  validateKey(key);
  return withCacheSpan(key, true, (setResult) => cacheRead(key, fn, ttl, setResult));
};

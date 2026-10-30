/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching, infrastructure:observability
 * @uses none
 */
import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import { log } from '@template/shared/logger';
import { incrementCounter } from '@template/shared/telemetry';

type CacheWriter = 'cache' | 'upsertCache';

const LARGE_CACHE_VALUE_BYTES = 256 * 1024;

export const meterLargeWrite = (
  key: string,
  payload: string,
  ttlSeconds: number,
  writer: CacheWriter,
): void => {
  const bytes = Buffer.byteLength(payload, 'utf8');
  if (bytes <= LARGE_CACHE_VALUE_BYTES) return;

  const accessor = cacheAccessor(key);
  incrementCounter('cache.value.large', 1, { accessor, writer });
  incrementCounter('cache.value.large.bytes', bytes, { accessor, writer }, 'By');
  log.warn(
    { event: 'cache.large_write', cacheKey: key, accessor, bytes, ttlSeconds, writer },
    'Large cache write',
  );
};

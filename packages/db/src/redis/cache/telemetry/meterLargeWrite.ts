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

// Where a cached value stops looking like a row set and starts looking like a dump. Not a limit:
// nothing refuses at it, and smaller writes are not metered at all.
const LARGE_CACHE_VALUE_BYTES = 256 * 1024;

// Cache, session, lock, lane and bull share one Redis, so an oversized value competes for memory
// with keys nothing can recreate; under an eviction policy the pressure surfaces only as unrelated
// keys disappearing. Reporting only: declining the write would leave nothing under the key and
// send every later caller back through single-flight to recompute serially.
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
  // The counters carry bounded tags only; the record names the entry and its ttl, because what a
  // key costs the keyspace is bytes held — 300KB for a day outweighs 2MB for a minute.
  log.warn(
    { event: 'cache.large_write', cacheKey: key, accessor, bytes, ttlSeconds, writer },
    'Large cache write',
  );
};

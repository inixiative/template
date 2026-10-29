/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching, infrastructure:observability
 * @uses none
 */
import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import { incrementCounter, withSpan } from '@template/shared/telemetry';

export type CacheResult = 'hit' | 'miss' | 'error' | 'written' | 'kept';

export const withCacheSpan = async <T>(
  key: string,
  shouldCount: boolean,
  run: (setResult: (result: CacheResult) => void) => Promise<T>,
): Promise<T> => {
  const accessor = cacheAccessor(key);
  let result: CacheResult = 'miss';
  const setResult = (next: CacheResult): void => {
    result = next;
  };

  return withSpan(
    `cache ${accessor}`,
    { attributes: { 'cache.accessor': accessor } },
    async (span) => {
      try {
        return await run(setResult);
      } finally {
        span.setAttribute('cache.result', result);
        if (shouldCount) incrementCounter('cache.read', 1, { accessor, result });
      }
    },
  );
};

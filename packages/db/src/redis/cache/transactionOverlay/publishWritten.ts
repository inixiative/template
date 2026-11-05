/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */

import { isPattern, matchesPattern } from '@template/db/redis/cache/cachePattern';
import { clearKey } from '@template/db/redis/cache/clearKey';
import type { CacheOverlay } from '@template/db/redis/cache/transactionOverlay/cacheOverlay';
import { publishKey } from '@template/db/redis/cache/transactionOverlay/publishKey';
import { ConcurrencyType, getConcurrency, resolveAll } from '@template/shared/utils';

const failureOf = (fn: () => Promise<unknown>) => async (): Promise<unknown> => {
  try {
    await fn();
    return null;
  } catch (error) {
    return error;
  }
};

export const publishWritten = async (overlay: CacheOverlay): Promise<unknown[]> => {
  const patterns = [...overlay.written].filter(isPattern);
  const keys = [...overlay.written].filter(
    (key) => !isPattern(key) && !patterns.some((pattern) => matchesPattern(pattern, key)),
  );
  const concurrency = getConcurrency([ConcurrencyType.redis]);
  const failures = [
    ...(await resolveAll(
      keys.map((key) => failureOf(() => publishKey(overlay, key))),
      concurrency,
    )),
    ...(await resolveAll(
      patterns.map((pattern) => failureOf(() => clearKey(pattern))),
      concurrency,
    )),
  ];
  return failures.filter((failure) => failure !== null);
};

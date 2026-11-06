/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */

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
  const failures = await resolveAll(
    [...overlay.written].map((key) => failureOf(() => publishKey(overlay, key))),
    getConcurrency([ConcurrencyType.redis]),
  );
  return failures.filter((failure) => failure !== null);
};

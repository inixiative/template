/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */

import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import {
  type CacheOverlay,
  isWrittenInTransaction,
} from '@template/db/redis/cache/transactionOverlay/cacheOverlay';
import { publishKey } from '@template/db/redis/cache/transactionOverlay/publishKey';
import { log } from '@template/shared/logger';
import { incrementCounter } from '@template/shared/telemetry';
import { ConcurrencyType, getConcurrency, resolveAll } from '@template/shared/utils';

export const publishWarm = async (overlay: CacheOverlay): Promise<void> => {
  const keys = [...overlay.values.keys()].filter((key) => !isWrittenInTransaction(overlay, key));
  await resolveAll(
    keys.map((key) => async () => {
      try {
        await publishKey(overlay, key);
      } catch (error) {
        log.error(`Failed to publish cache key ${key} after commit:`, error);
        incrementCounter('cache.publish.failed', 1, { accessor: cacheAccessor(key) });
      }
    }),
    getConcurrency([ConcurrencyType.redis]),
  );
};

/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { GENERATION_TTL_SECONDS } from '@template/db/redis/cache/generation/newGeneration';
import {
  type CommitEntry,
  publishAtCommit,
} from '@template/db/redis/cache/queries/publishAtCommit';
import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import { meterLargeWrite } from '@template/db/redis/cache/telemetry/meterLargeWrite';
import { redisClient } from '@template/db/redis/client';
import { incrementCounter } from '@template/shared/telemetry';

export const publishKeys = async (entries: CommitEntry[]): Promise<void> => {
  if (!entries.length) return;
  const published = await publishAtCommit(redisClient(), entries, GENERATION_TTL_SECONDS);
  for (const [i, entry] of entries.entries()) {
    if (published[i]) meterLargeWrite(entry.key, entry.payload, entry.ttlSeconds, 'cache');
    else if (entry.payload !== '')
      incrementCounter('cache.publish.skipped', 1, { accessor: cacheAccessor(entry.key) });
  }
};

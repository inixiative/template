/**
 * @atlas
 * @partOf primitive:caching, infrastructure:redis, infrastructure:prisma
 * @uses infrastructure:observability
 */
import { db } from '@template/db/client';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { DEFAULT_TTL } from '@template/db/redis/cache/defaultTtl';
import { fetchThroughCache } from '@template/db/redis/cache/fetchThroughCache';
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import { publishComputed } from '@template/db/redis/cache/publishComputed';
import { resolveTtl } from '@template/db/redis/cache/resolveTtl';
import { validateCacheKeyHasNoUndefined } from '@template/db/redis/cache/validateCacheKeyHasNoUndefined';
import { redisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import superjson from 'superjson';

// why: batch read-through cache for hydrateMany; single-key calls and transactional cache overlays
// delegate to fetchThroughCache to preserve single-flight locking and overlay semantics.
export const fetchManyThroughCache = async <T>(
  keys: readonly string[],
  fetchMisses: (missedKeys: readonly string[]) => Promise<Map<string, T>>,
  ttl: number | ((value: T | null) => number) = DEFAULT_TTL,
): Promise<(T | null)[]> => {
  if (keys.length === 0) return [];
  for (const key of keys) validateCacheKeyHasNoUndefined(key);

  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 1 || db.cacheOverlay()) {
    const byKey = new Map<string, T | null>();
    await Promise.all(
      uniqueKeys.map(async (key) => {
        const value = await fetchThroughCache<T | null>(
          key,
          async () => (await fetchMisses([key])).get(key) ?? null,
          ttl,
        );
        byKey.set(key, value);
      }),
    );
    return keys.map((key) => byKey.get(key) ?? null);
  }

  const redis = redisClient();
  const rawMget = await redis
    .mget(...uniqueKeys, ...uniqueKeys.map(generationKey))
    .catch((error) => {
      log.error('Batch cache read error:', error);
      return null;
    });

  const valueByKey = new Map<string, T | null>();
  const missedKeys: string[] = [];
  const capturedGenerations = new Map<string, string>();
  const corruptKeys = new Set<string>();

  for (let i = 0; i < uniqueKeys.length; i++) {
    const key = uniqueKeys[i]!;
    const payload = rawMget?.[i] ?? null;
    if (payload !== null) {
      try {
        const cachedValue = superjson.parse<T | null>(payload);
        if (cachedValue !== undefined) {
          valueByKey.set(key, cachedValue);
          continue;
        }
      } catch (error) {
        log.error(`Batch cache parse error for key ${key}:`, error);
        corruptKeys.add(key);
      }
    }
    missedKeys.push(key);
    if (rawMget) capturedGenerations.set(key, rawMget[uniqueKeys.length + i] ?? '0');
  }

  if (missedKeys.length > 0) {
    const loadedByKey = (await auditActorContext.withoutDeleted(() =>
      fetchMisses(missedKeys),
    )) as Map<string, T>;

    const writes: Promise<void>[] = [];
    for (const key of missedKeys) {
      const loadedValue = loadedByKey.get(key) ?? null;
      valueByKey.set(key, loadedValue);

      const capturedGeneration = capturedGenerations.get(key);
      const effectiveTtl = resolveTtl(loadedValue, ttl);
      if (capturedGeneration !== undefined && effectiveTtl > 0) {
        writes.push(
          publishComputed(
            redis,
            key,
            capturedGeneration,
            undefined,
            effectiveTtl,
            superjson.stringify(loadedValue),
            corruptKeys.has(key),
          ),
        );
      }
    }
    await Promise.all(writes);
  }

  return keys.map((key) => valueByKey.get(key) ?? null);
};

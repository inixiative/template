/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { redisNamespace } from '@template/db/redis/namespaces';

export const generationKey = (key: string): string => `${redisNamespace.cacheGeneration}:${key}`;

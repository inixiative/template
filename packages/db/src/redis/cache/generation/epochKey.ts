/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { redisNamespace } from '@template/db/redis/namespaces';

// One epoch for the whole cache: a pattern clear cannot bump the generation of keys it has not
// scanned yet, so it moves the epoch instead and every compute in flight anywhere skips its publish.
export const epochKey = (): string => `${redisNamespace.cacheGeneration}:epoch`;

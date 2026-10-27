/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { redisNamespace } from '@template/db/redis/namespaces';

// When the value under a key was written, in epoch ms. Every write sets it beside the value with the
// same TTL and an exact clear deletes it with the value. A pattern clear leaves it to expire: a write
// time with no value reads as empty.
export const writtenKey = (key: string): string => `${redisNamespace.cacheWritten}:${key}`;

/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { redisNamespace } from '@template/db/redis/namespaces';

export const cacheQueuedMarkerKeyFor = (computedUnder: string): string =>
  `${redisNamespace.cacheQueued}:${computedUnder}`;

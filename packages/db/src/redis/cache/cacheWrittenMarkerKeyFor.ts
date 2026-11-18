/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { redisNamespace } from '@template/db/redis/namespaces';

export const cacheWrittenMarkerKeyFor = (key: string): string =>
  `${redisNamespace.cacheWritten}:${key}`;

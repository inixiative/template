/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs, primitive:caching
 * @uses infrastructure:redis
 */
import { redisNamespace } from '@template/db';

// A rolling cache's scheduling state is one timer key in its own Redis namespace, plus the branch job
// itself while a refresh is running. No table and no BullMQ scheduler. The timer is not under `cache:`,
// so a cache flush clears the values but not the timer: readers compute on a cold miss until the next
// interval, the same as the first read after a deploy. Its TTL is one interval, set by the branch when
// it closes (once every leaf has reported); more than a tick left on it means the cache is not due.
export const rollingCacheTimerKey = (name: string): string =>
  `${redisNamespace.rollingCache}:timer:${name}`;

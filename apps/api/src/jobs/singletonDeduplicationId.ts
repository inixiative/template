/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses none
 */

// The BullMQ deduplication id for one singleton key: `<handler>-<key>`. enqueueJob adds a singleton job
// with it, so while a job with the same key exists (queued, running, retrying, or parked waiting on its
// children) another add is a no-op. That covers what the lock cannot: a staged singleton releases its
// lock while it waits in `waiting-children`, but it still exists, so the skip holds.
export const singletonDeduplicationId = (handlerName: string, key: string): string =>
  `${handlerName}-${key}`;

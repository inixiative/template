/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses primitive:shared
 */
import { makeSerializedQueue } from '@template/shared/utils';

// Shared mutex: every JobOutbox write (accumulator flush AND the drain) runs through this
// serialized queue, so a flush and a drain can never touch the table at the same time.
export const jobOutboxWriteMutex = makeSerializedQueue();
export const runUnderJobOutboxWriteMutex = <T>(fn: () => Promise<T>): Promise<T> =>
  jobOutboxWriteMutex.run(fn);

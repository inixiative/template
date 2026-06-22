/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses primitive:shared
 */
import { createSerializedQueue } from '@template/shared/utils';

// Shared mutex: every JobOutbox write (accumulator flush AND the drain) runs through this
// serialized queue, so a flush and a drain can never touch the table at the same time.
export const flushQueue = createSerializedQueue();
export const runOnOutboxQueue = <T>(fn: () => Promise<T>): Promise<T> => flushQueue.run(fn);

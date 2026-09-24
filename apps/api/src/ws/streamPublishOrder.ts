/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses primitive:shared
 */
import { createSerializedQueue, type SerializedQueue } from '@template/shared/utils';

const queues = new Map<string, SerializedQueue>();

export const inStreamOrder = <T>(stream: string, task: () => Promise<T>): Promise<T> => {
  const queue = queues.get(stream) ?? createSerializedQueue();
  queues.set(stream, queue);
  return queue.run(task).finally(() => {
    if (queue.size() === 0 && queues.get(stream) === queue) queues.delete(stream);
  });
};

export const pendingStreamQueues = (): number => queues.size;

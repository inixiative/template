/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { type QueueDepths, queueDepths } from '#/jobs/outbox/queueDepth';
import { queue } from '#/jobs/queue';
import { pruneSlowDeferred, readSlowIdleMs } from '#/jobs/slowLaneSignals';

export type SlowLaneState = {
  depths: QueueDepths;
  queued: number;
  deferred: number;
  idleMs: number;
};

export const readSlowLaneState = async (now: number = Date.now()): Promise<SlowLaneState> => {
  await pruneSlowDeferred(queue.redis, queue.name, now);
  const depths = await queueDepths(true);
  return {
    depths,
    queued: depths.slow,
    deferred: depths.slowDeferred,
    idleMs: await readSlowIdleMs(queue.redis, queue.name, depths.slow, now),
  };
};

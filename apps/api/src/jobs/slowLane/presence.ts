/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { LogScope, log } from '@template/shared/logger';
import { queue } from '#/jobs/queue';
import {
  WORKER_PRESENCE_HEARTBEAT_MS,
  WORKER_PRESENCE_TTL_MS,
  workerInstanceId,
  workerPresenceKey,
} from '#/jobs/slowLane/config';
import { makeUnrefInterval } from '#/lib/utils/makeUnrefInterval';

const refreshWorkerPresence = async (): Promise<void> => {
  await queue.redis.zadd(workerPresenceKey(), String(Date.now() + WORKER_PRESENCE_TTL_MS), workerInstanceId());
  await queue.redis.pexpire(workerPresenceKey(), WORKER_PRESENCE_TTL_MS);
};

const presenceLoop = makeUnrefInterval({
  intervalMs: WORKER_PRESENCE_HEARTBEAT_MS,
  tick: () =>
    void refreshWorkerPresence().catch((err) => log.error('Failed to refresh worker presence', err, LogScope.worker)),
});

export const startWorkerPresence = async (): Promise<void> => {
  if (presenceLoop.isRunning()) return;
  await refreshWorkerPresence();
  presenceLoop.start();
  log.info(
    `Started worker presence heartbeat (every ${WORKER_PRESENCE_HEARTBEAT_MS}ms, ttl ${WORKER_PRESENCE_TTL_MS}ms)`,
    LogScope.worker,
  );
};

export const stopWorkerPresence = async (): Promise<void> => {
  presenceLoop.stop();
  await queue.redis.zrem(workerPresenceKey(), workerInstanceId());
};

export const isWorkerPresenceRunning = (): boolean => presenceLoop.isRunning();

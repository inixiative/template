/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 * @constructs jobHandler
 */
import { createLock, type LockLostReason } from '@template/db';
import { log } from '@template/shared/logger';
import type { JobHandler, JobHandlerArgs } from '#/jobs/types';

const SINGLETON_LOCK_TTL_MS = 300_000;
const SINGLETON_LOCK_HEARTBEAT_MS = 60_000;
const SINGLETON_LOCK_MAX_MISSED = 3;

export const makeSingletonJob = <TPayload = void>(handler: JobHandler<TPayload>): JobHandler<TPayload> => {
  return async (ctx, ...args: JobHandlerArgs<TPayload>) => {
    // Lock lane prefers `data.id` (cron path: row's uuidv7) so one handler can serve
    // multiple singleton lanes (e.g. one cron job per row); falls back to `job.name`
    // for ad-hoc/test invocations without a faked id.
    const identifier = (ctx.job.data as { id?: string } | undefined)?.id ?? ctx.job.name;
    if (!identifier) throw new Error('Singleton job missing id and name');

    const scope = { jobId: ctx.job.id, identifier };
    let hasLostLock = false;
    let hasHandlerSucceeded = false;
    const markLockLost = (reason: LockLostReason): void => {
      if (hasLostLock) return;
      hasLostLock = true;
      log.error('singletonJob.lockLost', { ...scope, reason });
    };

    // The lock lives on the queue's connection, not the shared cache client: an evicted cache
    // key would silently open the singleton to a second run.
    const lock = createLock({
      service: 'job-singleton',
      identifier,
      redis: ctx.queue.redis,
      ttlMs: SINGLETON_LOCK_TTL_MS,
      heartbeatMs: SINGLETON_LOCK_HEARTBEAT_MS,
      maxMissed: SINGLETON_LOCK_MAX_MISSED,
      onLockLost: markLockLost,
    });
    if (!(await lock.acquire())) return;
    const startedAt = Date.now();

    try {
      // WorkerContext has no cooperative cancellation. A run that loses its lock is reported,
      // not cancelled: racing a rejection would leave the handler running while BullMQ retries
      // it, which is a third concurrent run.
      await handler(ctx, ...args);
      hasHandlerSucceeded = true;
    } finally {
      const releaseResult = await lock.release();
      if (releaseResult === 'notHeld') markLockLost('token_mismatch');
      if (releaseResult === 'unconfirmed') {
        log.warn('singletonJob.releaseUnconfirmed', {
          ...scope,
          message: 'The key is freed if the delete still reaches Redis, otherwise at its TTL',
        });
      }
      if (hasLostLock) {
        const event = hasHandlerSucceeded ? 'singletonJob.completedAfterLockLoss' : 'singletonJob.failedAfterLockLoss';
        const leaseHeldToRelease = releaseResult === 'released';
        const context = { ...scope, durationMs: Date.now() - startedAt, leaseHeldToRelease };
        if (leaseHeldToRelease) log.warn(event, context);
        else log.error(event, context);
      }
    }
  };
};

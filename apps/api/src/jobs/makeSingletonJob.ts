/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 * @constructs jobHandler
 */
import { createLock } from '@template/db';
import type { JobHandler, JobHandlerArgs } from '#/jobs/types';

export const makeSingletonJob = <TPayload = void>(handler: JobHandler<TPayload>): JobHandler<TPayload> => {
  return async (ctx, ...args: JobHandlerArgs<TPayload>) => {
    // Lock lane prefers `data.id` (cron path: row's uuidv7) so one handler can serve
    // multiple singleton lanes (e.g. one cron job per row); falls back to `job.name`
    // for ad-hoc/test invocations without a faked id.
    const identifier = (ctx.job.data as { id?: string } | undefined)?.id ?? ctx.job.name;
    if (!identifier) throw new Error('Singleton job missing id and name');

    const lock = createLock({ service: 'job-singleton', identifier, ttlMs: 300_000, heartbeatMs: 60_000, maxMissed: 3 });
    if (!(await lock.acquire())) return;

    try {
      await handler(ctx, ...args);
    } finally {
      await lock.release();
    }
  };
};

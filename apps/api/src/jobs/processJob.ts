/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import { db } from '@template/db';
import { auditActorContext, nullAuditActor } from '@template/db/lib/auditActorContext';
import { addLogBroadcast, LogScope, log, logScope } from '@template/shared/logger';
import type { Job } from 'bullmq';
import { isValidHandlerName, type JobHandlers, jobHandlers } from '#/jobs/handlers';
import { queue } from '#/jobs/queue';
import { traceJob } from '#/jobs/traceJob';
import type { WorkerContext } from '#/jobs/types';

type ProcessJobSeams = {
  handlers?: Partial<JobHandlers>;
};

export const processJob = async (job: Job, { handlers = jobHandlers }: ProcessJobSeams = {}): Promise<void> => {
  const handler = isValidHandlerName(job.name) ? handlers[job.name] : undefined;
  if (!handler) {
    log.error(`Unknown job handler: ${job.name}`, LogScope.worker);
    throw new Error(`Unknown job handler: ${job.name}`);
  }

  const scopeId = `${job.name}:${job.id}`;
  await traceJob(job, () =>
    logScope(LogScope.worker, () =>
      logScope(scopeId, () =>
        db.scope(
          scopeId,
          async () => {
            addLogBroadcast((_level, msg) => job.log(msg));

            const ctx: WorkerContext = { db, queue, job };

            log.info(`Processing job ${job.name} (${job.id})`);

            const payload = (job.data as { payload?: unknown }).payload;
            await auditActorContext.scope({ ...nullAuditActor, actorJobName: job.name }, async () => {
              if (payload === undefined) {
                await (handler as (handlerCtx: WorkerContext) => Promise<void>)(ctx);
              } else {
                await (handler as (handlerCtx: WorkerContext, handlerPayload: unknown) => Promise<void>)(ctx, payload);
              }
            });

            log.info(`Completed job ${job.name} (${job.id})`);
          },
          'worker',
        ),
      ),
    ),
  );
};

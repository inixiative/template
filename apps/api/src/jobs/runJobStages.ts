/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { LogScope, log } from '@template/shared/logger';
import { type Job, WaitingChildrenError } from 'bullmq';
import { enqueueJob } from '#/jobs/enqueue';
import type {
  EnqueueChildJob,
  JobData,
  JobHandler,
  JobHandlerArgs,
  StagedJob,
  WorkerContext,
} from '#/jobs/types';

// Under a worker (the job holds a token) each child is added with this job as its BullMQ parent and
// `ignoreDependencyOnFailure`: the child keeps the queue's retries, and only once its last attempt
// fails does it count as done, so a dead child never holds its parent open. An inline run has no
// token and no parent: the child runs inside the call, and one that throws is logged and swallowed,
// which is what `ignoreDependencyOnFailure` does under a worker.
const childJobEnqueuer = (job: Job, onAdded: () => void): EnqueueChildJob => {
  const parent = job.token && job.id ? { id: job.id, queue: job.queueQualifiedName } : undefined;
  return async (handlerName, payload) => {
    onAdded();
    if (parent) {
      await enqueueJob(handlerName, payload, { parent, ignoreDependencyOnFailure: true });
      return;
    }
    try {
      await enqueueJob(handlerName, payload);
    } catch (err) {
      log.warn(
        `Child job ${handlerName} failed; its parent ${job.name} (${job.id}) carries on`,
        { err },
        LogScope.job,
      );
    }
  };
};

// The handler makeJob builds from `{ stages, finish }`: a BullMQ flow parent run as a step job. The
// next stage lives on the job envelope (`stage`), so a resumed run starts there and an earlier stage
// never reruns. After a stage that added children the job parks in `waiting-children`, holding no
// worker slot, and BullMQ runs it again once the last child has reported; a stage that added none
// runs straight into the next. A worker that dies mid-stage leaves `stage` unchanged, so the retry
// reruns that stage and may add its children twice: children must be idempotent.
// An inline run (no token) runs every stage and `finish` in order within one call.
export const runJobStages =
  <TPayload>({ stages, finish }: StagedJob<TPayload>): JobHandler<TPayload> =>
  async (ctx: WorkerContext, ...args: JobHandlerArgs<TPayload>) => {
    const { job } = ctx;
    const { token } = job;
    const resumeAt = (job.data as JobData).stage ?? 0;
    for (const [offset, runStage] of stages.slice(resumeAt).entries()) {
      let hasAddedChildren = false;
      const enqueueChildJob = childJobEnqueuer(job, () => {
        hasAddedChildren = true;
      });
      await runStage({ ...ctx, enqueueChildJob }, ...args);
      if (!token) continue;
      await job.updateData({ ...job.data, stage: resumeAt + offset + 1 });
      if (hasAddedChildren && (await job.moveToWaitingChildren(token)))
        throw new WaitingChildrenError();
    }
    await finish(ctx, ...args);
  };

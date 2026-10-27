/**
 * @atlas
 * @kind constructor, service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 * @constructs childJobEnqueuer
 */
import { enqueueJob } from '#/jobs/enqueue';
import type { EnqueueChildJob, WorkerContext } from '#/jobs/types';
import { validateChildJobHandler } from '#/jobs/validateChildJobHandler';

// The `enqueueChildJob` a stage receives. Under a worker (the job holds a token) each child is added
// with this job as its BullMQ parent and `ignoreDependencyOnFailure`: the child keeps the queue's
// retries, and only once its last attempt fails does it count as done, so a dead child never holds its
// parent open. An inline test run has no token and no parent: the child runs inside the call, and a
// child that throws fails the parent's call. Child-failure tolerance is BullMQ's, exercised against
// real Redis by `apps/api/scripts/jobFlowCheck.ts`.
export const makeEnqueueChildJob =
  (
    { job }: WorkerContext,
    { childrenMustSupersede }: { childrenMustSupersede: boolean },
  ): EnqueueChildJob =>
  async (handlerName, payload, { delay }: { delay?: number } = {}) => {
    if (childrenMustSupersede) await validateChildJobHandler(handlerName);
    const parent = job.token && job.id ? { id: job.id, queue: job.queueQualifiedName } : undefined;
    const options = {
      ...(parent && { parent, ignoreDependencyOnFailure: true }),
      ...(delay && { delay }),
    };
    await enqueueJob(handlerName, payload, Object.keys(options).length ? options : undefined);
  };

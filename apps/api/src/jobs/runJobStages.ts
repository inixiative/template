/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { makeEnqueueChildJob } from '#/jobs/makeEnqueueChildJob';
import { parkOnUnfinishedChildren } from '#/jobs/parkOnUnfinishedChildren';
import type { JobData, JobHandler, JobHandlerArgs, StagedJob, WorkerContext } from '#/jobs/types';

// The handler every job constructor builds from `{ stages, finish }` (via toJobHandler): a BullMQ flow
// parent run as a step job. The current stage lives on the job envelope (`stage`), so each run starts
// where the last one stopped and code in an earlier stage never runs twice.
//
// After a stage the job records `stage + 1` and parks if any child is unfinished
// (parkOnUnfinishedChildren); BullMQ runs it again once the last child has reported. With nothing
// unfinished the next stage runs straight away in the same run. `finish` runs once, after the last
// stage's children have reported.
//
// A run that resumes past stage 0 parks first if children are still unfinished: a worker that died
// between recording the stage and parking would otherwise retry straight into the next stage while the
// previous stage's children were still running. A worker that dies mid-stage leaves `stage` unchanged,
// so the retry runs that stage again and may add its children twice: children must be idempotent.
//
// An inline test run has no token: children run inline as they are added, so the stages and `finish`
// simply run in order within one call.
export const runJobStages = <TPayload>(
  { stages, finish }: StagedJob<TPayload>,
  options: { childrenMustSupersede: boolean } = { childrenMustSupersede: false },
): JobHandler<TPayload> => {
  const handler: JobHandler<TPayload> = async (
    ctx: WorkerContext,
    ...args: JobHandlerArgs<TPayload>
  ) => {
    const { job } = ctx;
    const { token } = job;
    const resumeAt = (job.data as JobData).stage ?? 0;
    if (token && resumeAt > 0) await parkOnUnfinishedChildren(job, token);
    const enqueueChildJob = makeEnqueueChildJob(ctx, options);
    for (const [offset, runStage] of stages.slice(resumeAt).entries()) {
      await runStage({ ...ctx, enqueueChildJob }, ...args);
      if (!token) continue;
      await job.updateData({ ...job.data, stage: resumeAt + offset + 1 });
      await parkOnUnfinishedChildren(job, token);
    }
    await finish(ctx, ...args);
  };
  return handler;
};

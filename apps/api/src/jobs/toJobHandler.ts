/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses none
 */
import { runJobStages } from '#/jobs/runJobStages';
import type { JobHandler, StagedJob } from '#/jobs/types';

// What every job constructor (makeJob, makeSingletonJob, makeSupersedingJob) does with its first
// argument: a plain handler is used as is, `{ stages, finish }` becomes a staged handler. A superseding
// job passes `childrenMustSupersede`, because a superseded parent evicts its children through their
// lanes, and only a superseding child has a lane.
export const toJobHandler = <TPayload>(
  definition: JobHandler<TPayload> | StagedJob<TPayload>,
  { childrenMustSupersede = false }: { childrenMustSupersede?: boolean } = {},
): JobHandler<TPayload> =>
  typeof definition === 'function'
    ? definition
    : runJobStages(definition, { childrenMustSupersede });

/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses none
 */
import { runJobStages } from '#/jobs/runJobStages';
import type { JobHandler, StagedJob } from '#/jobs/types';

// What every job constructor (makeJob, makeSingletonJob, makeSupersedingJob) does with its first
// argument: a plain handler is used as is, `{ stages, finish }` becomes a staged handler
// (runJobStages). A superseding job passes `childrenMustSupersede`: its children stop by honouring its
// tombstone, and only a superseding child checks for one.
export const toJobHandler = <TPayload>(
  definition: JobHandler<TPayload> | StagedJob<TPayload>,
  { childrenMustSupersede = false }: { childrenMustSupersede?: boolean } = {},
): JobHandler<TPayload> =>
  typeof definition === 'function'
    ? definition
    : runJobStages(definition, { childrenMustSupersede });

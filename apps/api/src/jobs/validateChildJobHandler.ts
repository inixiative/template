/**
 * @atlas
 * @kind validator
 * @partOf primitive:jobs
 * @uses none
 */
import type { JobPayloads } from '#/jobs/handlers';
import type { SupersedingJobHandler } from '#/jobs/makeSupersedingJob';

// When a superseding parent is superseded, its children stop because they honour its tombstone, and
// only a superseding child checks for one. So a superseding parent refuses a child whose handler is
// not superseding, at the moment it tries to add it. A singleton or plain parent is never superseded
// and may have any children.
export const validateChildJobHandler = async (handlerName: keyof JobPayloads): Promise<void> => {
  // Lazy for the same reason as enqueueJob: the registry imports every handler.
  const { jobHandlers } = await import('#/jobs/handlers');
  if ((jobHandlers[handlerName] as SupersedingJobHandler<unknown>).dedupeKeyFn) return;
  throw new Error(
    `A superseding job's children must be superseding jobs, and "${handlerName}" is not`,
  );
};

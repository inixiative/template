/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs, primitive:caching
 * @uses infrastructure:redis
 */
import { listRollingCaches } from '@template/db';
import { enqueueJob } from '#/jobs/enqueue';

// On worker boot, enqueue every registered cache's branch rather than waiting for its timer, so a
// deploy that changed a cache's result keys does not serve cold reads until the next interval. The
// branch is a keyed singleton, so a branch already open makes this a no-op.
export const warmRollingCaches = async (): Promise<void> => {
  for (const { name } of listRollingCaches()) await enqueueJob('refreshRollingCache', { name });
};

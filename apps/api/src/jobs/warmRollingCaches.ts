/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs, primitive:caching
 * @uses infrastructure:redis
 */
import { listRollingCaches } from '@template/db';
import { enqueueJob } from '#/jobs/enqueue';

export const warmRollingCaches = async (): Promise<void> => {
  for (const { name } of listRollingCaches()) await enqueueJob('refreshRollingCache', { name });
};

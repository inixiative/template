/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import type { Job } from 'bullmq';

export const hasUnfinishedChildren = async (job: Job): Promise<boolean> =>
  ((await job.getDependenciesCount({ unprocessed: true })).unprocessed ?? 0) > 0;

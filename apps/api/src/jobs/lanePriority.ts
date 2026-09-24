/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses none
 */
import { type JobsOptions, PRIORITY_LIMIT } from 'bullmq';
import { isSlowJobData } from '#/jobs/buildJobData';
import type { JobData } from '#/jobs/types';

// BullMQ moves a job to active from the plain wait list first and from the prioritized set only
// when the wait list is empty. Slow jobs carry the lowest priority BullMQ allows, so every fast job
// — and any job given an explicit priority — is picked before them, while idle slots still run them.
export const SLOW_LANE_PRIORITY = PRIORITY_LIMIT;

export const withLanePriority = <T extends JobsOptions>(data: Pick<JobData, 'lane'>, options: T): T =>
  isSlowJobData(data) ? { ...options, priority: SLOW_LANE_PRIORITY } : options;

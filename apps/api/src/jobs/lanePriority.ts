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
// when the wait list is empty, lowest priority number first. So the service order is: no priority
// (the fast lane), then any explicit priority below PRIORITY_LIMIT — the band for work that should
// yield to fast jobs but run ahead of a large send — then PRIORITY_LIMIT itself, the slow lane. Idle
// slots still run slow work.
export const SLOW_LANE_PRIORITY = PRIORITY_LIMIT;

// The one place a lane becomes a BullMQ option. A slow job's own requested priority is replaced: the
// slow lane is always last. A fast job keeps the priority it was given, including the slow value: a job
// at SLOW_LANE_PRIORITY waits and counts as slow work (queueDepths counts that band) whatever its lane tag
// says, which is what the caller asked for.
export const withLanePriority = <T extends JobsOptions>(data: Pick<JobData, 'lane'>, options: T): T =>
  isSlowJobData(data) ? { ...options, priority: SLOW_LANE_PRIORITY } : options;

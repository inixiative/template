/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses none
 */
import type { JobsOptions } from 'bullmq';
import { isSlowJobData } from '#/jobs/buildJobData';
import type { JobData } from '#/jobs/types';

// BullMQ moves a job to active from the plain wait list first and from the prioritized set only
// when the wait list is empty, lowest priority number first. So the service order is: no priority
// (the fast lane), then any explicit priority below SLOW_LANE_PRIORITY — the band for work that should
// yield to fast jobs but run ahead of a large send — then SLOW_LANE_PRIORITY itself, the slow lane.
// Not BullMQ's PRIORITY_LIMIT (2^21): its score, priority * 2^32 + counter, passes 2^53 there and
// equal-priority jobs collide in Redis's double scores and lose their FIFO order.
export const SLOW_LANE_PRIORITY = 2 ** 21 - 1;

// The one place a lane becomes a BullMQ option. A slow job's own requested priority is replaced: the
// slow lane is always last. A fast job keeps the priority it was given, including the slow value: a job
// at SLOW_LANE_PRIORITY waits and counts as slow work (queueDepths counts that band) whatever its lane tag
// says, which is what the caller asked for. A priority above SLOW_LANE_PRIORITY is clamped to it, so no job
// sorts behind the slow lane or outside the slow band count.
export const withLanePriority = <T extends JobsOptions>(data: Pick<JobData, 'lane'>, options: T): T => {
  if (isSlowJobData(data)) return { ...options, priority: SLOW_LANE_PRIORITY };
  if (options.priority !== undefined && options.priority > SLOW_LANE_PRIORITY) {
    return { ...options, priority: SLOW_LANE_PRIORITY };
  }
  return options;
};

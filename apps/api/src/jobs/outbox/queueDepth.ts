/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import { DEPTH_CACHE_MS } from '#/jobs/outbox/config';
import { queue } from '#/jobs/queue';
import { JobLane } from '#/jobs/types';

export type QueueDepths = { total: number; slow: number };

// --- depth probe: `total` counts the waiting backlog, the prioritized set and in-flight, NOT `delayed`
// (which includes scheduled cron repeats — a standing floor that isn't overflow pressure). `slow` is
// the number of jobs waiting at the slow priority, read with BullMQ's own per-priority count (a ZCOUNT
// over that priority's score band), so a job given an explicit priority between the lanes sits in the
// prioritized set without counting against the slow share. Cached ~1s. ---
let cached: QueueDepths = { total: 0, slow: 0 };
let cachedAt = 0;

export const queueDepths = async (fresh = false): Promise<QueueDepths> => {
  const now = Date.now();
  if (!fresh && now - cachedAt < DEPTH_CACHE_MS) return cached;
  const [counts, perPriority] = await Promise.all([
    queue.getJobCounts('waiting', 'prioritized', 'active'),
    queue.getCountsPerPriority([SLOW_LANE_PRIORITY]),
  ]);
  cached = {
    total: (counts.waiting ?? 0) + (counts.prioritized ?? 0) + (counts.active ?? 0),
    slow: perPriority[String(SLOW_LANE_PRIORITY)] ?? 0,
  };
  cachedAt = now;
  return cached;
};

export const laneDepth = (depths: QueueDepths, lane: JobLane): number =>
  lane === JobLane.slow ? depths.slow : depths.total;

/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import { DEPTH_CACHE_MS } from '#/jobs/outbox/config';
import { queue } from '#/jobs/queue';
import { readSlowDeferred } from '#/jobs/slowLaneSignals';
import { JobLane } from '#/jobs/types';

export type QueueDepths = { total: number; slow: number; slowDeferred: number };

// --- depth probe: `total` counts the waiting backlog, the prioritized set, in-flight, and the slow jobs the
// lane deferred into `delayed` — not the rest of `delayed` (scheduled cron repeats, backoff retries: a
// standing floor that isn't overflow pressure). `slow` is the slow priority band (BullMQ's own per-priority
// count) plus those deferred slow jobs. Cached ~1s. ---
let cached: QueueDepths = { total: 0, slow: 0, slowDeferred: 0 };
let cachedAt = 0;

// Capped at `delayed`: a listed job already promoted into the slow band must not count twice.
export const laneDepthsFrom = (
  counts: Partial<Record<string, number>>,
  slowBand: number,
  slowListed: number,
): QueueDepths => {
  const slowDeferred = Math.min(slowListed, counts.delayed ?? slowListed);
  return {
    total: (counts.waiting ?? 0) + (counts.prioritized ?? 0) + (counts.active ?? 0) + slowDeferred,
    slow: slowBand + slowDeferred,
    slowDeferred,
  };
};

export const queueDepths = async (fresh = false): Promise<QueueDepths> => {
  const now = Date.now();
  if (!fresh && now - cachedAt < DEPTH_CACHE_MS) return cached;
  const [counts, perPriority, slowListed] = await Promise.all([
    queue.getJobCounts('waiting', 'prioritized', 'active', 'delayed'),
    queue.getCountsPerPriority([SLOW_LANE_PRIORITY]),
    readSlowDeferred(queue.redis, queue.name, now),
  ]);
  cached = laneDepthsFrom(counts, perPriority[String(SLOW_LANE_PRIORITY)] ?? 0, slowListed);
  cachedAt = now;
  return cached;
};

export const laneDepth = (depths: QueueDepths, lane: JobLane): number =>
  lane === JobLane.slow ? depths.slow : depths.total;

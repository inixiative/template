/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { DEPTH_CACHE_MS } from '#/jobs/outbox/config';
import { queue } from '#/jobs/queue';
import { JobLane } from '#/jobs/types';

export type QueueDepths = { total: number; slow: number };

// --- depth probe: counts the waiting backlog + in-flight, NOT `delayed` (which includes
// scheduled cron repeats — a standing floor that isn't overflow pressure). Cached ~1s.
// Slow jobs wait in BullMQ's prioritized set, so `prioritized` is the slow lane's pressure and the
// total is everything waiting or running. ---
let cached: QueueDepths = { total: 0, slow: 0 };
let cachedAt = 0;

export const queueDepths = async (fresh = false): Promise<QueueDepths> => {
  const now = Date.now();
  if (!fresh && now - cachedAt < DEPTH_CACHE_MS) return cached;
  const counts = await queue.getJobCounts('waiting', 'prioritized', 'active');
  const slow = counts.prioritized ?? 0;
  cached = { total: (counts.waiting ?? 0) + slow + (counts.active ?? 0), slow };
  cachedAt = now;
  return cached;
};

export const laneDepth = (depths: QueueDepths, lane: JobLane): number =>
  lane === JobLane.slow ? depths.slow : depths.total;

export const queueDepth = async (fresh = false): Promise<number> => (await queueDepths(fresh)).total;

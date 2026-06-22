/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { DEPTH_CACHE_MS } from '#/jobs/outbox/config';
import { queue } from '#/jobs/queue';

// --- depth probe: counts the waiting backlog + in-flight, NOT `delayed` (which includes
// scheduled cron repeats — a standing floor that isn't overflow pressure). Cached ~1s. ---
let cachedDepth = 0;
let cachedAt = 0;

export const queueDepth = async (fresh = false): Promise<number> => {
  const now = Date.now();
  if (!fresh && now - cachedAt < DEPTH_CACHE_MS) return cachedDepth;
  const counts = await queue.getJobCounts('waiting', 'active');
  cachedDepth = (counts.waiting ?? 0) + (counts.active ?? 0);
  cachedAt = now;
  return cachedDepth;
};

/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { redisNamespace } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { queue } from '#/jobs/queue';
import type { JobData } from '#/jobs/types';

// Abort any queued/in-flight job in one of these supersede lanes — ONE queue scan for the whole
// set, so the drain can signal every lane in its batch without re-scanning the queue per row.
export const signalSupersededLanes = async (dedupeKeys: Set<string>): Promise<void> => {
  if (!dedupeKeys.size) return; // no superseding rows → no scan
  const jobs = await queue.getJobs(['active', 'waiting', 'delayed', 'paused']);
  for (const job of jobs) {
    if (!job.id) continue;
    const lane = (job.data as JobData).dedupeKey;
    if (lane && dedupeKeys.has(lane)) {
      await queue.redis.set(`${redisNamespace.job}:superseded:${job.id}`, '1', 'EX', 300);
      log.info(`Signaled job ${job.id} to abort (superseded)`, LogScope.job);
    }
  }
};

// Single-lane convenience for the direct enqueue path.
export const signalSupersededJobs = (dedupeKey: string): Promise<void> => signalSupersededLanes(new Set([dedupeKey]));

/**
 * @atlas
 * @kind config
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:env
 */
import '#/config/env';
import { redisNamespace } from '@template/db';
import { JobLane } from '#/jobs/types';

export const maxQueueDepth = (): number => process.env.JOBS_MAX_QUEUE_DEPTH;
// Slow work waits in Redis like everything else, but may fill only its share of the depth budget;
// fast work may use the whole budget.
export const maxSlowQueueDepth = (): number =>
  Math.max(1, Math.floor(maxQueueDepth() * process.env.JOBS_SLOW_QUEUE_DEPTH_FRACTION));
export const laneDepthCap = (lane: JobLane): number => (lane === JobLane.slow ? maxSlowQueueDepth() : maxQueueDepth());
export const lowWater = (lane: JobLane = JobLane.fast): number => Math.floor(laneDepthCap(lane) * 0.8);
export const flushMaxRows = (): number => process.env.JOBS_OUTBOX_FLUSH_MAX_ROWS;
export const flushLinger = (): number => process.env.JOBS_OUTBOX_FLUSH_LINGER_MS;
export const overflowStuckMs = (): number => process.env.JOBS_OVERFLOW_STUCK_MS;
// Flag TTL — a safety net so a dead drain doesn't pin overflow forever; the drain heartbeats it
// (withOverflowRenew) while alive. ms→s for Redis EX.
export const overflowTtlSec = (): number => Math.ceil(process.env.JOBS_OVERFLOW_TTL_MS / 1000);
// A row that fails re-enqueue this many times is quarantined (skipped by the drain) so it can't sit at
// the FIFO head and starve newer rows.
export const MAX_DRAIN_ATTEMPTS = 5;
export const DEPTH_CACHE_MS = 1000;
export const SHUTDOWN_FLUSH_RETRIES = 3;

export const flagKey = (lane: JobLane = JobLane.fast): string =>
  lane === JobLane.slow ? `${redisNamespace.job}:overflow:slow` : `${redisNamespace.job}:overflow`;

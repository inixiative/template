/**
 * @atlas
 * @kind config
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:env
 */
import '#/config/env';
import { redisNamespace } from '@template/db';

export const maxQueueDepth = (): number => process.env.JOBS_MAX_QUEUE_DEPTH;
export const lowWater = (): number => Math.floor(maxQueueDepth() * 0.8);
export const flushMaxRows = (): number => process.env.JOBS_OUTBOX_FLUSH_MAX_ROWS;
export const flushLinger = (): number => process.env.JOBS_OUTBOX_FLUSH_LINGER_MS;
export const overflowStuckMs = (): number => process.env.JOBS_OVERFLOW_STUCK_MS;
// Flag TTL — a safety net so a dead drain doesn't pin overflow forever; the drain heartbeats it
// (withOverflowRenew) while alive. ms→s for Redis EX.
export const overflowTtlSec = (): number => Math.ceil(process.env.JOBS_OVERFLOW_TTL_MS / 1000);
export const maxSlowAdmissions = (): number => process.env.JOBS_OUTBOX_MAX_SLOW_ADMISSIONS;
// A row that fails re-enqueue this many times is quarantined (skipped by the drain) so it can't sit at
// the FIFO head and starve newer rows.
export const MAX_DRAIN_ATTEMPTS = 5;
export const DEPTH_CACHE_MS = 1000;
export const SHUTDOWN_FLUSH_RETRIES = 3;

export const FLAG_KEY = `${redisNamespace.job}:overflow`;

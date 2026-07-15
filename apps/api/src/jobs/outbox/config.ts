/**
 * @atlas
 * @kind config
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { redisNamespace } from '@template/db';

// Config is read lazily (not frozen at import) so it's overridable per process and in tests.
const num = (v: string | undefined, fallback: number): number => (v === undefined ? fallback : Number(v));
export const maxQueueDepth = (): number => num(process.env.JOBS_MAX_QUEUE_DEPTH, 10_000);
export const lowWater = (): number => Math.floor(maxQueueDepth() * 0.8);
export const flushMaxRows = (): number => num(process.env.JOBS_OUTBOX_FLUSH_MAX_ROWS, 1000);
export const flushLinger = (): number => num(process.env.JOBS_OUTBOX_FLUSH_LINGER_MS, 200);
export const overflowStuckMs = (): number => num(process.env.JOBS_OVERFLOW_STUCK_MS, 300_000);
// Flag TTL — a safety net so a dead drain doesn't pin overflow forever; the drain heartbeats it
// (withOverflowRenew) while alive. ms→s for Redis EX.
export const overflowTtlSec = (): number => Math.ceil(num(process.env.JOBS_OVERFLOW_TTL_MS, 60_000) / 1000);
export const DEPTH_CACHE_MS = 1000;
export const SHUTDOWN_FLUSH_RETRIES = 3;

export const FLAG_KEY = `${redisNamespace.job}:overflow`;

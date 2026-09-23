/**
 * @atlas
 * @kind config
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:env
 */
import '#/config/env';
import { redisNamespace } from '@template/db';

const WORKER_BOOT_ID = crypto.randomUUID();

export const WORKER_PRESENCE_TTL_MS = 60_000;
export const WORKER_PRESENCE_HEARTBEAT_MS = Math.floor(WORKER_PRESENCE_TTL_MS / 3);

export const workerInstanceId = (): string => WORKER_BOOT_ID;

export const jobsWorkerConcurrency = (): number => process.env.JOBS_WORKER_CONCURRENCY;

export const bulkSlotFraction = (): number => process.env.BULK_SLOT_FRACTION;

export const configuredBulkSlots = (): number | undefined => process.env.BULK_SLOTS;

export const bulkLeaseTtlMs = (): number => process.env.BULK_LEASE_TTL_MS;

// Renewal lands well before expiry with slack for a slow round trip, so the beat derives from the
// TTL instead of being a second knob that could be configured above it.
export const bulkLeaseHeartbeatMs = (): number => Math.max(1, Math.floor(bulkLeaseTtlMs() / 3));

export const bulkSlotsKey = (): string => `${redisNamespace.job}:bulk:slots`;

export const workerPresenceKey = (): string => `${redisNamespace.job}:bulk:workers`;

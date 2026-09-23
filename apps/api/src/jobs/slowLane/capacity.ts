/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import type { Redis } from 'ioredis';
import { type BulkCapacity, evaluateBulkCapacity } from '#/jobs/queries/evaluateBulkCapacity';
import {
  bulkLeaseTtlMs,
  bulkSlotFraction,
  bulkSlotsKey,
  configuredBulkSlots,
  jobsWorkerConcurrency,
  workerPresenceKey,
} from '#/jobs/slowLane/config';

export type { BulkCapacity };

const evaluate = (redis: Pick<Redis, 'eval'>, member: string): Promise<BulkCapacity> =>
  evaluateBulkCapacity(redis, {
    slotsKey: bulkSlotsKey(),
    presenceKey: workerPresenceKey(),
    now: Date.now(),
    configuredSlots: configuredBulkSlots(),
    concurrency: jobsWorkerConcurrency(),
    fraction: bulkSlotFraction(),
    member,
    leaseTtlMs: bulkLeaseTtlMs(),
  });

export const bulkCapacity = (redis: Pick<Redis, 'eval'>): Promise<BulkCapacity> => evaluate(redis, '');

export const claimBulkSlot = (redis: Pick<Redis, 'eval'>, member: string): Promise<BulkCapacity> => {
  if (!member) throw new Error('claimBulkSlot requires a member id');
  return evaluate(redis, member);
};

export const releaseBulkSlot = (redis: Pick<Redis, 'zrem'>, member: string): Promise<number> =>
  redis.zrem(bulkSlotsKey(), member);

export const renewBulkSlot = async (
  redis: Pick<Redis, 'zadd' | 'pexpire'>,
  member: string,
): Promise<{ reacquired: boolean }> => {
  const leaseTtlMs = bulkLeaseTtlMs();
  const added = await redis.zadd(bulkSlotsKey(), String(Date.now() + leaseTtlMs), member);
  await redis.pexpire(bulkSlotsKey(), leaseTtlMs);
  return { reacquired: added === 1 };
};

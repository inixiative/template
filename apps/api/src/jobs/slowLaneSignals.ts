/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:env
 */
import '#/config/env';
import { redisNamespace } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import type { Redis } from 'ioredis';
import type { JobsQueue } from '#/jobs/types';

export const SLOW_DEFERRED_GRACE_MS = 5 * 60_000;
export const SLOW_PARK_MIN_MS = 2_000;
export const SLOW_PARK_MS_PER_QUEUED = 20;

type SignalRedis = Pick<Redis, 'zadd' | 'zrem' | 'zcount' | 'zremrangebyscore' | 'set' | 'get' | 'del'>;

export const slowDeferredKey = (queueName: string): string => `${redisNamespace.job}:${queueName}:slow:deferred`;

export const slowLastFinishedKey = (queueName: string): string =>
  `${redisNamespace.job}:${queueName}:slow:lastFinished`;

export const recordSlowDeferral = async (
  redis: SignalRedis,
  queueName: string,
  jobId: string,
  dueAt: number,
): Promise<void> => {
  await redis.zadd(slowDeferredKey(queueName), dueAt, jobId);
};

export const recordDelayedSlowAdd = async (
  queue: Pick<JobsQueue, 'redis' | 'name'>,
  jobId: string,
  delayMs: number,
): Promise<void> => {
  try {
    await recordSlowDeferral(queue.redis, queue.name, jobId, Date.now() + delayMs);
  } catch (err) {
    log.warn('Failed to record a delayed slow add in the slow-lane deferral list', { err, jobId }, LogScope.job);
  }
};

export const releaseSlowDeferral = async (redis: SignalRedis, queueName: string, jobId: string): Promise<void> => {
  await redis.zrem(slowDeferredKey(queueName), jobId);
};

export const readSlowDeferred = (redis: SignalRedis, queueName: string, now: number = Date.now()): Promise<number> =>
  redis.zcount(slowDeferredKey(queueName), now - SLOW_DEFERRED_GRACE_MS, '+inf');

export const pruneSlowDeferred = async (
  redis: SignalRedis,
  queueName: string,
  now: number = Date.now(),
): Promise<void> => {
  await redis.zremrangebyscore(slowDeferredKey(queueName), '-inf', `(${now - SLOW_DEFERRED_GRACE_MS}`);
};

export const recordSlowFinished = async (
  redis: SignalRedis,
  queueName: string,
  now: number = Date.now(),
): Promise<void> => {
  await redis.set(slowLastFinishedKey(queueName), String(now));
};

export const readSlowIdleMs = async (
  redis: SignalRedis,
  queueName: string,
  queuedSlow: number,
  now: number = Date.now(),
): Promise<number> => {
  const key = slowLastFinishedKey(queueName);
  if (queuedSlow === 0) {
    await redis.del(key);
    return 0;
  }
  await redis.set(key, String(now), 'NX');
  const since = Number(await redis.get(key));
  return Number.isFinite(since) ? Math.max(0, now - since) : 0;
};

export const slowParkDelayMs = (queuedSlow: number, random: () => number = Math.random): number => {
  const spread = Math.min(
    process.env.JOBS_SLOW_PARK_MAX_MS,
    Math.max(SLOW_PARK_MIN_MS, queuedSlow * SLOW_PARK_MS_PER_QUEUED),
  );
  return SLOW_PARK_MIN_MS + Math.floor(random() * (spread - SLOW_PARK_MIN_MS));
};

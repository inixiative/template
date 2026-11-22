/**
 * @atlas
 * @kind query
 * @partOf primitive:requestContext
 * @uses infrastructure:redis
 */
import type { RedisEval } from '@template/db';

// Atomic check + INCRBY + first-hit PEXPIRE: rejected requests do not burn remaining budget, and a crash cannot strand a TTL-less key.
const INCR_WINDOW =
  "local cost = tonumber(ARGV[2]) local max = tonumber(ARGV[3]) local cur = tonumber(redis.call('GET', KEYS[1]) or '0') if max and cur + cost > max then return {cur + cost, redis.call('PTTL', KEYS[1])} end local c = redis.call('INCRBY', KEYS[1], cost) if redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end return {c, redis.call('PTTL', KEYS[1])}";

export type FixedWindow = { key: string; windowMs: number; cost?: number; max?: number };
export type WindowState = { count: number; ttlMs: number };

// One eval per window, dispatched together: ioredis writes them back-to-back, so a request pays one round trip.
export const incrementFixedWindows = async (
  redis: RedisEval,
  windows: FixedWindow[],
): Promise<WindowState[]> => {
  for (const { cost = 1 } of windows) {
    if (!Number.isSafeInteger(cost) || cost <= 0) {
      throw new RangeError(`Rate limit cost must be a positive integer, got ${cost}`);
    }
  }

  const results = (await Promise.all(
    windows.map(({ key, windowMs, cost = 1, max }) =>
      max === undefined
        ? redis.eval(INCR_WINDOW, 1, key, String(windowMs), String(cost))
        : redis.eval(INCR_WINDOW, 1, key, String(windowMs), String(cost), String(max)),
    ),
  )) as [number, number][];

  return results.map(([count, ttlMs]) => ({ count, ttlMs }));
};

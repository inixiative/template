/**
 * @atlas
 * @kind query
 * @partOf primitive:requestContext
 * @uses infrastructure:redis
 */
import type { RedisEval } from '@template/db';

// Atomic INCR + first-hit PEXPIRE: a crash between a separate INCR and EXPIRE strands a TTL-less key that wedges an identity over-limit forever.
const INCR_WINDOW =
  "local c = redis.call('INCR', KEYS[1]) if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end return {c, redis.call('PTTL', KEYS[1])}";

export type FixedWindow = { key: string; windowMs: number };
export type WindowState = { count: number; ttlMs: number };

// One eval per window, dispatched together: ioredis writes them back-to-back, so a request pays one round trip.
export const incrementFixedWindows = async (
  redis: RedisEval,
  windows: FixedWindow[],
): Promise<WindowState[]> => {
  const results = (await Promise.all(
    windows.map(({ key, windowMs }) => redis.eval(INCR_WINDOW, 1, key, String(windowMs))),
  )) as [number, number][];

  return results.map(([count, ttlMs]) => ({ count, ttlMs }));
};

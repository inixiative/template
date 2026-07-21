/**
 * @atlas
 * @kind utils
 * @partOf primitive:requestContext
 * @uses infrastructure:redis
 */

// Atomic INCR + first-hit PEXPIRE: a crash between a separate INCR and EXPIRE strands a TTL-less key that wedges an identity over-limit forever.
const INCR_WINDOW =
  "local c = redis.call('INCR', KEYS[1]) if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end return {c, redis.call('PTTL', KEYS[1])}";

type EvalCapable = { eval: (script: string, numKeys: number, ...args: (string | number)[]) => Promise<unknown> };

export type FixedWindow = { key: string; windowMs: number };
export type WindowState = { count: number; ttlMs: number };

export const incrementFixedWindows = async (redis: EvalCapable, windows: FixedWindow[]): Promise<WindowState[]> => {
  const results = (await Promise.all(
    windows.map(({ key, windowMs }) => redis.eval(INCR_WINDOW, 1, key, String(windowMs))),
  )) as [number, number][];

  return results.map(([count, ttlMs]) => ({ count, ttlMs }));
};

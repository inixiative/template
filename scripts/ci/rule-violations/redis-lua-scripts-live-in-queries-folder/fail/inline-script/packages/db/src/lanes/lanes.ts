const CLAIM = "local previous = redis.call('get', KEYS[1]) return previous";
export const claim = (redis: { eval: (...args: unknown[]) => Promise<unknown> }, key: string) =>
  redis.eval(CLAIM, 1, key);

import type { Context, Next } from 'hono';
import { getRedisClient } from '#/lib/clients/redis';

type RateLimitConfig = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
};

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, max, keyPrefix = 'rl' } = config;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (c: Context, next: Next) => {
    const redis = getRedisClient();
    const ip = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown';
    const key = `${keyPrefix}:${ip}`;

    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);

    if (count > max) {
      return c.json({ error: 'Too Many Requests', message: 'Rate limit exceeded' }, 429);
    }

    await next();
  };
}

export const authRateLimit = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'rl:auth' });
export const emailRateLimit = rateLimit({ windowMs: 3600_000, max: 20, keyPrefix: 'rl:email' });

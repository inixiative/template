import type { Context, Next } from 'hono';
import { getRedisClient, redisNamespace } from '@template/db';

import type { AppEnv } from '#/types/appEnv';

const DEFAULT_RATE_LIMIT = 10; // requests per second

/**
 * Rate limiting middleware.
 *
 * Runs AFTER auth middleware so it can check for tokens.
 * - If token exists: uses token's rateLimitPerSecond (or default), keyed by token ID
 * - If no token: uses default limit, keyed by IP
 */
export const apiRateLimit = async (c: Context<AppEnv>, next: Next) => {
  const redis = getRedisClient();
  const token = c.get('token');

  const limit = token?.rateLimitPerSecond ?? DEFAULT_RATE_LIMIT;
  const identifier = token ? `token:${token.id}` : `ip:${getClientIp(c)}`;
  const redisKey = `${redisNamespace.limit}:api:${identifier}`;

  const count = await redis.incr(redisKey);
  if (count === 1) await redis.expire(redisKey, 1); // 1 second window

  if (count > limit) {
    return c.json({ error: 'Too Many Requests', message: 'Rate limit exceeded' }, 429);
  }

  await next();
};

/**
 * Create a custom rate limiter for specific endpoints.
 */
type RateLimitConfig = {
  windowMs: number;
  max: number;
  key: string;
};

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, max, key } = config;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (c: Context<AppEnv>, next: Next) => {
    const redis = getRedisClient();
    const ip = getClientIp(c);
    const redisKey = `${redisNamespace.limit}:${key}:${ip}`;

    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSec);

    if (count > max) {
      return c.json({ error: 'Too Many Requests', message: 'Rate limit exceeded' }, 429);
    }

    await next();
  };
}

const getClientIp = (c: Context): string =>
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';

// Pre-configured limiters for common use cases
export const authRateLimit = rateLimit({ windowMs: 60_000, max: 10, key: 'auth' });
export const emailRateLimit = rateLimit({ windowMs: 3_600_000, max: 20, key: 'email' });

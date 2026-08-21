/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:errors, primitive:requestContext
 */
import { getRedisClient, redisNamespace } from '@template/db';
import type { Context, Next } from 'hono';

import { clientIp } from '#/lib/clientIp';
import { makeError } from '#/lib/errors';
import { incrementFixedWindows } from '#/middleware/rateLimit/incrementFixedWindows';
import type { AppEnv } from '#/types/appEnv';

const DEFAULT_RATE_LIMIT_PER_SECOND = 10;

export const apiRateLimit = async (c: Context<AppEnv>, next: Next) => {
  const token = c.get('token');

  const limit = token?.rateLimitPerSecond ?? DEFAULT_RATE_LIMIT_PER_SECOND;
  const identifier = token ? `token:${token.id}` : `ip:${clientIp(c)}`;
  const redisKey = `${redisNamespace.limit}:api:${identifier}`;

  const [window] = await incrementFixedWindows(getRedisClient(), [{ key: redisKey, windowMs: 1_000 }]);

  if (window && window.count > limit) throw makeError({ status: 429, message: 'Rate limit exceeded' });

  await next();
};

type RateLimitConfig = {
  windowMs: number;
  max: number;
  key: string;
};

export const rateLimit = (config: RateLimitConfig) => {
  const { windowMs, max, key } = config;

  return async (c: Context<AppEnv>, next: Next) => {
    const redisKey = `${redisNamespace.limit}:${key}:${clientIp(c)}`;

    const [window] = await incrementFixedWindows(getRedisClient(), [{ key: redisKey, windowMs }]);

    if (window && window.count > max) throw makeError({ status: 429, message: 'Rate limit exceeded' });

    await next();
  };
};

export const authRateLimit = rateLimit({ windowMs: 60_000, max: 10, key: 'auth' });
export const emailRateLimit = rateLimit({ windowMs: 3_600_000, max: 20, key: 'email' });

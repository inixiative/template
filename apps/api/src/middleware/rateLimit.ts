/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:errors
 */
import { getRedisClient, redisNamespace } from '@template/db';
import type { Context, Next } from 'hono';

import { clientIp } from '#/lib/clientIp';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

const DEFAULT_RATE_LIMIT = 10; // requests per second

export const apiRateLimit = async (c: Context<AppEnv>, next: Next) => {
  const redis = getRedisClient();
  const token = c.get('token');

  const limit = token?.rateLimitPerSecond ?? DEFAULT_RATE_LIMIT;
  const identifier = token ? `token:${token.id}` : `ip:${clientIp(c)}`;
  const redisKey = `${redisNamespace.limit}:api:${identifier}`;

  const count = await redis.incr(redisKey);
  if (count === 1) await redis.expire(redisKey, 1); // 1 second window

  if (count > limit) {
    throw makeError({ status: 429, message: 'Rate limit exceeded' });
  }

  await next();
};

type RateLimitConfig = {
  windowMs: number;
  max: number;
  key: string;
};

export const rateLimit = (config: RateLimitConfig) => {
  const { windowMs, max, key } = config;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (c: Context<AppEnv>, next: Next) => {
    const redis = getRedisClient();
    const redisKey = `${redisNamespace.limit}:${key}:${clientIp(c)}`;

    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSec);

    if (count > max) {
      throw makeError({ status: 429, message: 'Rate limit exceeded' });
    }

    await next();
  };
};

export const authRateLimit = rateLimit({ windowMs: 60_000, max: 10, key: 'auth' });
export const emailRateLimit = rateLimit({ windowMs: 3_600_000, max: 20, key: 'email' });

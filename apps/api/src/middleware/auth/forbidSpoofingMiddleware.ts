/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:errors
 */
import type { Context, Next } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const forbidSpoofingMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('spoofedBy')) {
    throw makeError({
      status: 403,
      message: 'This action cannot be performed while spoofing another user',
    });
  }
  await next();
};

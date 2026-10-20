/**
 * @atlas
 * @kind validator, middleware
 * @partOf feature:auth
 * @uses primitive:errors
 */
import type { Context, Next } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const validateNotSpoofed = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('spoofedBy'))
    throw makeError({ status: 403, message: 'Stop spoofing to change account credentials' });
  await next();
};

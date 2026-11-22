/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:errors
 */
import type { Context, Next } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const validateAuthenticatedMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (!c.get('user') && !c.get('token')) {
    throw makeError({ status: 401, message: 'Authentication required' });
  }
  await next();
};

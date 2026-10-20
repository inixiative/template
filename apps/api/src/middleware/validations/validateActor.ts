/**
 * @atlas
 * @kind validator, middleware
 * @partOf feature:auth
 * @uses primitive:requestContext, primitive:errors
 */
import type { Context, Next } from 'hono';
import { getPrincipal } from '#/lib/context/getPrincipal';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const validateActor = async (c: Context<AppEnv>, next: Next) => {
  if (!getPrincipal(c).user) throw makeError({ status: 401, message: 'Authentication required' });
  await next();
};

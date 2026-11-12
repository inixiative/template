/**
 * @atlas
 * @kind middleware
 * @partOf primitive:requestContext, primitive:authz
 * @uses primitive:errors
 */
import type { Context, Next } from 'hono';
import { me } from '#/lib/context/me';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const meResourceMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const user = me(c);
  if (!user) throw makeError({ status: 401, message: 'Authentication required' });
  c.set('resource', user);
  c.set('resourceType', 'user');
  await next();
};

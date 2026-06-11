/**
 * @atlas
 * @kind validator, middleware
 * @partOf feature:auth
 * @uses primitive:requestContext, primitive:errors
 */
import type { Context, Next } from 'hono';
import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { makeError } from '#/lib/errors';

import type { AppEnv } from '#/types/appEnv';

export const validateNotToken = async (c: Context<AppEnv>, next: Next) => {
  if (!c.get('user')) throw makeError({ status: 401, message: 'Authentication required' });
  // Superadmins bypass — their token already grants the same authority as session.
  if (c.get('token') && !isSuperadmin(c)) {
    throw makeError({ status: 403, message: 'Tokens cannot perform this action' });
  }
  await next();
};

/**
 * @atlas
 * @kind validator, middleware
 * @partOf primitive:authz
 * @uses primitive:requestContext, primitive:errors
 */
import type { Action } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

export const validateSelfPermission = makeMiddleware<Action>((action) => async (c, next) => {
  const user = c.get('user');
  if (!user) throw makeError({ status: 401, message: 'Authentication required' });
  if (!check(c.get('permix'), rebacSchema, 'user', user, action))
    throw makeError({ status: 403, message: 'Access denied' });
  await next();
});

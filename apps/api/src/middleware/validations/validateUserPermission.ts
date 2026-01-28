import type { UserId } from '@template/db';
import type { Action } from '@template/permissions/client';
import { HTTPException } from 'hono/http-exception';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

type Options = {
  action: Action;
  field?: string; // defaults to 'userId'
};

type Resource = Record<string, unknown> | null;

export const validateUserPermission = makeMiddleware<Options>(({ action, field = 'userId' }) => async (c, next) => {
  const resource = c.get('resource') as Resource;
  const resourceType = c.get('resourceType');

  // Get userId: either resource[field], or resource.id if resource IS a user
  const userId = (resourceType === 'user' ? resource?.id : resource?.[field]) as UserId | undefined;

  // No userId on resource → skip check (might be org-owned)
  if (!userId) return next();

  if (!c.get('permix').check('user', action, userId)) {
    throw new HTTPException(403, { message: 'Access denied' });
  }

  await next();
});

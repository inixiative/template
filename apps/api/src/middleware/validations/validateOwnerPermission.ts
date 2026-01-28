import type { OrganizationId, UserId } from '@template/db';
import type { Action } from '@template/permissions/client';
import { HTTPException } from 'hono/http-exception';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

type Options = {
  action: Action;
  ownerField?: string; // defaults to 'ownerModel'
  userIdField?: string; // defaults to 'userId'
  orgIdField?: string; // defaults to 'organizationId'
};

type Resource = Record<string, unknown> | null;

/**
 * Check permission based on polymorphic owner (user OR org).
 * Restrictive by default - throws if no valid permission found.
 */
export const validateOwnerPermission = makeMiddleware<Options>((options) => async (c, next) => {
  const {
    action,
    ownerField = 'ownerModel',
    userIdField = 'userId',
    orgIdField = 'organizationId',
  } = options;

  const resource = c.get('resource') as Resource;
  const permix = c.get('permix');
  const ownerModel = resource?.[ownerField] as string | undefined;

  if (ownerModel === 'User' || ownerModel === 'OrganizationUser') {
    const userId = resource?.[userIdField] as UserId | undefined;
    if (userId && permix.check('user', action, userId)) return next();
  }

  if (ownerModel === 'Organization') {
    const orgId = resource?.[orgIdField] as OrganizationId | undefined;
    if (orgId && permix.check('organization', action, orgId)) return next();
  }

  throw new HTTPException(403, { message: 'Access denied' });
});

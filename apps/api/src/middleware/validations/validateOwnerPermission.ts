import { db, hydrate, type OrganizationId, type SpaceId, type UserId } from '@template/db';
import type { Action } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { HTTPException } from 'hono/http-exception';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

type Options = {
  action: Action;
  ownerField?: string; // defaults to 'ownerModel'
  userIdField?: string; // defaults to 'userId'
  orgIdField?: string; // defaults to 'organizationId'
  spaceIdField?: string; // defaults to 'spaceId'
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
    spaceIdField = 'spaceId',
  } = options;

  const resource = c.get('resource') as Resource;
  const permix = c.get('permix');
  const ownerModel = resource?.[ownerField] as string | undefined;

  if (ownerModel === 'User' || ownerModel === 'OrganizationUser') {
    const userId = resource?.[userIdField] as UserId | undefined;
    if (userId) {
      const hydratedUser = await hydrate(db, 'user', { id: userId });
      if (check(permix, rebacSchema, 'user', hydratedUser, action)) return next();
    }
  }

  if (ownerModel === 'Organization') {
    const orgId = resource?.[orgIdField] as OrganizationId | undefined;
    if (orgId) {
      const hydratedOrg = await hydrate(db, 'organization', { id: orgId });
      if (check(permix, rebacSchema, 'organization', hydratedOrg, action)) return next();
    }
  }

  if (ownerModel === 'Space') {
    const spaceId = resource?.[spaceIdField] as SpaceId | undefined;
    if (spaceId) {
      const hydratedSpace = await hydrate(db, 'space', { id: spaceId });
      if (check(permix, rebacSchema, 'space', hydratedSpace, action)) return next();
    }
  }

  throw new HTTPException(403, { message: 'Access denied' });
});

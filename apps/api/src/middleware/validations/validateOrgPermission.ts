import type { OrganizationId } from '@template/db';
import type { Action } from '@template/permissions/client';
import { HTTPException } from 'hono/http-exception';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

type Resource = { id?: string; organizationId?: string } | null;

export const validateOrgPermission = makeMiddleware<Action>((action) => async (c, next) => {
  const resource = c.get('resource') as Resource;
  const resourceType = c.get('resourceType');

  // Get orgId: either resource.organizationId, or resource.id if resource IS an organization
  const orgId = (
    resourceType === 'organization' ? resource?.id : resource?.organizationId
  ) as OrganizationId | undefined;

  if (!orgId) return next();

  if (!c.get('permix').check('organization', action, orgId)) {
    throw new HTTPException(403, { message: 'Access denied' });
  }

  await next();
});

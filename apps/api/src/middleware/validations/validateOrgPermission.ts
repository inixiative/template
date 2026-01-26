import type { OrganizationId } from '@template/db';
import type { Action } from '@template/permissions/client';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '#/types/appEnv';

type Resource = { id?: string; organizationId?: string } | null;

/**
 * Validate org permission for a given action.
 * Assumes setupOrgPermissions was called during auth.
 */
export const validateOrgPermission = (action: Action) => async (c: Context<AppEnv>, next: Next) => {
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
};

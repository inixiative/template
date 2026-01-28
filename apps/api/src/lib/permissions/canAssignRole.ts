import { type OrganizationId, OrganizationRole } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { HTTPException } from 'hono/http-exception';

export const canAssignRole = (permix: Permix, orgId: OrganizationId, targetRole: OrganizationRole) => {
  const action = ([OrganizationRole.owner, OrganizationRole.admin] as OrganizationRole[]).includes(targetRole)
    ? 'own'
    : 'manage';
  if (!permix.check('organization', action, orgId)) {
    throw new HTTPException(403, { message: `Cannot assign ${targetRole} role` });
  }
};

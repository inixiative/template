import type { OrganizationId } from '@template/db';
import {
  type Entitlements,
  getOrgPermissions,
  intersectEntitlements,
  lesserRole,
  type Role,
} from '@template/permissions';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';
import { validateRole } from './validateRole';

/**
 * Set up permissions for user's orgs at auth time.
 * Applies token restrictions (lesserRole, intersectEntitlements) if present.
 */
export const setupOrgPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  const orgUsers = c.get('organizationUsers');

  // Org token → single org, token permissions only
  if (token?.ownerModel === 'Organization' && token.organizationId) {
    await permix.setup(
      getOrgPermissions(
        validateRole(token.role),
        token.organizationId as OrganizationId,
        token.entitlements as Entitlements,
      ),
    );
    return;
  }

  // OrgUser token → single org, lesser of orgUser + token
  if (token?.ownerModel === 'OrganizationUser' && token.organizationId) {
    const orgUser = orgUsers?.find((ou) => ou.organizationId === token.organizationId);
    if (orgUser) {
      await permix.setup(
        getOrgPermissions(
          lesserRole(validateRole(orgUser.role), validateRole(token.role)),
          token.organizationId as OrganizationId,
          intersectEntitlements(orgUser.entitlements as Entitlements, token.entitlements as Entitlements),
        ),
      );
    }
    return;
  }

  // No org memberships → nothing to set up
  if (!orgUsers?.length) return;

  // User token or session → all orgs (with token restrictions if present)
  for (const orgUser of orgUsers) {
    const orgId = orgUser.organizationId as OrganizationId;
    const role = token
      ? lesserRole(validateRole(orgUser.role), validateRole(token.role))
      : validateRole(orgUser.role);
    const entitlements = token
      ? intersectEntitlements(orgUser.entitlements as Entitlements, token.entitlements as Entitlements)
      : (orgUser.entitlements as Entitlements);

    await permix.setup(getOrgPermissions(role, orgId, entitlements));
  }
};

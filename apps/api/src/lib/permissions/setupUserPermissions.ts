/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 */
import type { UserId } from '@template/db';
import { type Entitlements, getUserPermissions } from '@template/permissions';
import type { Context } from 'hono';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export const setupUserPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const user = c.get('user');
  const token = c.get('token');

  // No user → no user permissions
  if (!user) return;

  // Org or OrgUser tokens are org-scoped, don't get user permissions
  if (token?.ownerModel === 'Organization' || token?.ownerModel === 'OrganizationUser') {
    return;
  }

  // User token → restricted by token role
  if (token?.ownerModel === 'User') {
    await permix.setup(
      getUserPermissions(user.id as UserId, validateRole(token.role), token.entitlements as Entitlements),
    );
    return;
  }

  // Session auth → owner (full permissions)
  await permix.setup(getUserPermissions(user.id as UserId));
};

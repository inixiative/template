import { type Entitlements, Role, setupUserContext } from '@template/permissions';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

/**
 * Set up permissions for user's own resources at auth time.
 * - Session auth → owner (full permissions)
 * - User token → restricted by token role
 * - Org/OrgUser tokens → no user permissions (org-scoped)
 */
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
    await setupUserContext(permix, {
      user,
      role: (token.role as Role) ?? Role.owner,
      entitlements: token.entitlements as Entitlements,
    });
    return;
  }

  // Session auth → owner (full permissions)
  await setupUserContext(permix, { user });
};


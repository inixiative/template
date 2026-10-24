/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { UserId } from '@template/db';
import { type Entitlements, getUserPermissions, UserAction } from '@template/permissions';
import type { Context } from 'hono';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export const setupUserPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const user = c.get('user');
  const token = c.get('token');

  // No user → no user permissions
  if (!user) return;

  // A membership's token knows who it is, and holds nothing else on the person.
  if (token && token.ownerModel !== 'User') {
    if (token.ownerModel === 'OrganizationUser' || token.ownerModel === 'SpaceUser')
      await permix.setup({
        resource: 'db:user',
        id: user.id,
        actions: { [UserAction.identify]: true },
      });
    return;
  }

  // User token → restricted by token role
  if (token?.ownerModel === 'User') {
    await permix.setup(
      getUserPermissions(
        user.id as UserId,
        validateRole(token.role),
        token.entitlements as Entitlements,
      ),
    );
    return;
  }

  // Person JWT → owner (full permissions)
  await permix.setup(getUserPermissions(user.id as UserId));
};

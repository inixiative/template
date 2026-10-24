/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { UserId } from '@template/db';
import {
  createPermissions,
  type Entitlements,
  getUserPermissions,
  narrowing,
  UserAction,
} from '@template/permissions';
import type { Context } from 'hono';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export const setupUserPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const user = c.get('user');
  const token = c.get('token');

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

  const person = getUserPermissions(user.id as UserId);

  // A User token is a narrowing of the person: its claim on the user, owned by the person's table.
  if (token) {
    const owner = createPermissions();
    await owner.setup(person);
    await permix.setup(
      narrowing(
        'db:user',
        user.id,
        validateRole(token.role),
        token.entitlements as Entitlements,
        null,
      ),
      { owner },
    );
    return;
  }

  await permix.setup(person);
};

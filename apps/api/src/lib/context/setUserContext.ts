/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses infrastructure:prisma, primitive:authz
 */
import type { UserWithRelations } from '@template/db';
import { ActorModel, isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupSpacePermissions } from '#/lib/permissions/setupSpacePermissions';
import { setupUserPermissions } from '#/lib/permissions/setupUserPermissions';
import type { AppEnv } from '#/types/appEnv';

export const setUserContext = async (c: Context<AppEnv>, userWithRelations: UserWithRelations) => {
  const { organizationUsers, organizations, spaceUsers, spaces, ...user } = userWithRelations;

  c.set('user', user);
  c.set('organizationUsers', organizationUsers);
  c.set('organizations', organizations);
  c.set('spaceUsers', spaceUsers);
  c.set('spaces', spaces);

  const permix = c.get('permix');
  const token = c.get('token');
  permix.setActor(
    token ? { id: token.id, model: ActorModel.Token } : { id: user.id, model: ActorModel.User },
  );
  // Set both ways: a superadmin spoofing a normal user must not retain the flag.
  permix.setSuperadmin(isSuperadmin(user));
  await setupUserPermissions(c);
  await setupOrgPermissions(c);
  await setupSpacePermissions(c);
};

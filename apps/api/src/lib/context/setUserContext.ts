import { isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupSpacePermissions } from '#/lib/permissions/setupSpacePermissions';
import { setupUserPermissions } from '#/lib/permissions/setupUserPermissions';
import type { UserWithMemberships } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const setUserContext = async (c: Context<AppEnv>, userWithMemberships: UserWithMemberships) => {
  const { organizationUsers, spaceUsers, ...user } = userWithMemberships;
  c.set('user', user);
  c.set('organizationUsers', organizationUsers);
  c.set('spaceUsers', spaceUsers);

  if (isSuperadmin(user)) c.get('permix').setSuperadmin(true);
  await setupUserPermissions(c);
  await setupOrgPermissions(c);
  await setupSpacePermissions(c);
};

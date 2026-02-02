import { isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupUserPermissions } from '#/lib/permissions/setupUserPermissions';
import type { UserWithOrganizationUsers } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const setUserContext = async (c: Context<AppEnv>, userWithOrgs: UserWithOrganizationUsers) => {
  const { organizationUsers, ...user } = userWithOrgs;
  c.set('user', user);
  c.set('organizationUsers', organizationUsers);

  const permix = c.get('permix');
  permix.setUserId(user.id);
  if (isSuperadmin(user)) permix.setSuperadmin(true);
  await setupUserPermissions(c);
  await setupOrgPermissions(c);
};

import { isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import type { UserWithOrganizationUsers } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const setUserContext = async (c: Context<AppEnv>, userWithOrgs: UserWithOrganizationUsers) => {
  const { organizationUsers, ...user } = userWithOrgs;
  c.set('user', user);
  c.set('organizationUsers', organizationUsers);

  if (isSuperadmin(user)) c.get('permix').setSuperadmin(true);
  await setupOrgPermissions(c);
};

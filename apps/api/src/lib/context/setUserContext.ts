import { isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupSpacePermissions } from '#/lib/permissions/setupSpacePermissions';
import { setupUserPermissions } from '#/lib/permissions/setupUserPermissions';
import type { UserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';
import type {UserId} from "@template/db/typedModelIds";

export const setUserContext = async (c: Context<AppEnv>, userWithRelations: UserWithRelations) => {
  const { organizationUsers, organizations, spaceUsers, spaces, ...user } = userWithRelations;

  c.set('user', user);
  c.set('organizationUsers', organizationUsers);
  c.set('organizations', organizations);
  c.set('spaceUsers', spaceUsers);
  c.set('spaces', spaces);

  const permix = c.get('permix');
  permix.setUserId(user.id as UserId);
  if (isSuperadmin(user)) permix.setSuperadmin(true);
  await setupUserPermissions(c);
  await setupOrgPermissions(c);
  await setupSpacePermissions(c);
};

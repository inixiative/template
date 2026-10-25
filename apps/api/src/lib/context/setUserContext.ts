/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses infrastructure:prisma, primitive:authz
 */
import type { UserWithRelations } from '@template/db';
import type { Context } from 'hono';
import { installPermissions } from '#/lib/context/installPermissions';
import type { AppEnv } from '#/types/appEnv';

export const setUserContext = async (c: Context<AppEnv>, userWithRelations: UserWithRelations) => {
  const { organizationUsers, organizations, spaceUsers, spaces, ...user } = userWithRelations;

  c.set('user', user);
  c.set('organizationUsers', organizationUsers);
  c.set('organizations', organizations);
  c.set('spaceUsers', spaceUsers);
  c.set('spaces', spaces);

  await installPermissions(c);
};

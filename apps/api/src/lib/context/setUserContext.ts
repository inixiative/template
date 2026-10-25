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

type Seats = Pick<
  UserWithRelations,
  'organizationUsers' | 'organizations' | 'spaceUsers' | 'spaces'
>;

export const setMemberContext = (c: Context<AppEnv>, seats: Seats | null) => {
  c.set('organizationUsers', seats?.organizationUsers ?? []);
  c.set('organizations', seats?.organizations ?? []);
  c.set('spaceUsers', seats?.spaceUsers ?? []);
  c.set('spaces', seats?.spaces ?? []);
};

export const setUserContext = async (c: Context<AppEnv>, userWithRelations: UserWithRelations) => {
  const { organizationUsers, organizations, spaceUsers, spaces, ...user } = userWithRelations;
  c.set('user', user);
  setMemberContext(c, { organizationUsers, organizations, spaceUsers, spaces });
  await installPermissions(c);
};

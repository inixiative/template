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

type Members = Pick<
  UserWithRelations,
  'organizationUsers' | 'organizations' | 'spaceUsers' | 'spaces'
>;

export const setMemberContext = (c: Context<AppEnv>, members: Members | null) => {
  c.set('organizationUsers', members?.organizationUsers ?? []);
  c.set('organizations', members?.organizations ?? []);
  c.set('spaceUsers', members?.spaceUsers ?? []);
  c.set('spaces', members?.spaces ?? []);
};

export const setUserContext = async (c: Context<AppEnv>, userWithRelations: UserWithRelations) => {
  const { organizationUsers, organizations, spaceUsers, spaces, ...user } = userWithRelations;
  c.set('user', user);
  setMemberContext(c, { organizationUsers, organizations, spaceUsers, spaces });
  await installPermissions(c);
};

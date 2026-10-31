/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { UserWithRelations } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import {
  ActorModel,
  actorOf,
  installPermissions,
  isSuperadmin,
  permissionsOfUser,
} from '@template/permissions';
import { createPermissions, type Permix } from '@template/permissions/client';
import type { TokenWithRelations } from '#/lib/context/types';
import { delegatedPermissions, ownerPermissions } from '#/lib/permissions/ownerPermissions';
import { findUserWithRelations } from '#/modules/user/services/find';

type Acting = Pick<UserWithRelations, 'organizationUsers' | 'spaceUsers'> & {
  user: User | null;
  token: TokenWithRelations | null;
};

export const installPermissionsFor = async (
  permix: Permix,
  { user, token, organizationUsers, spaceUsers }: Acting,
) => {
  await permix.setup([], { replace: true });
  if (token) permix.setActor(actorOf(ActorModel.Token, token));
  else if (user) permix.setActor(actorOf(ActorModel.User, user));
  permix.setSuperadmin(isSuperadmin(user));

  const usersPermissions = permissionsOfUser(user?.id ?? null, organizationUsers, spaceUsers);
  if (!token) return installPermissions(permix, usersPermissions);
  const owner = token.ownerModel === 'User' ? usersPermissions : await ownerPermissions(token);
  await installPermissions(permix, delegatedPermissions(token, owner));
};

export const userPermissions = async (userId: string): Promise<Permix | null> => {
  const userWithRelations = await findUserWithRelations(userId);
  if (!userWithRelations) return null;
  const {
    organizationUsers,
    organizations: _,
    spaceUsers,
    spaces: __,
    ...user
  } = userWithRelations;
  const permix = createPermissions();
  await installPermissionsFor(permix, { user, token: null, organizationUsers, spaceUsers });
  return permix;
};

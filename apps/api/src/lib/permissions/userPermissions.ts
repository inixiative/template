/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { OrganizationUser, SpaceUser, User } from '@template/db/generated/client/client';
import {
  ActorModel,
  actorOf,
  installGrants,
  isSuperadmin,
  userGrants,
} from '@template/permissions';
import { createPermissions, type Permix } from '@template/permissions/client';
import { findUserWithRelations } from '#/modules/user/services/find';

type Members = { organizationUsers: OrganizationUser[]; spaceUsers: SpaceUser[] };

export const installUserPermissions = async (permix: Permix, user: User, members: Members) => {
  await permix.setup([], { replace: true });
  permix.setActor(actorOf(ActorModel.User, user));
  permix.setSuperadmin(isSuperadmin(user));
  await installGrants(permix, userGrants(user.id, members.organizationUsers, members.spaceUsers));
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
  await installUserPermissions(permix, user, { organizationUsers, spaceUsers });
  return permix;
};

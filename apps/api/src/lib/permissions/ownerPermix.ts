/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { UserWithRelations } from '@template/db';
import { createPermissions, type Permix } from '@template/permissions';
import type { IntegrationWithOwners, TokenWithRelations } from '#/lib/context/types';
import { buildIntegrationPermix } from '#/lib/permissions/buildIntegrationPermix';
import { buildMembershipPermix } from '#/lib/permissions/buildMembershipPermix';
import { buildOrganizationPermix } from '#/lib/permissions/buildOrganizationPermix';
import { buildSpacePermix } from '#/lib/permissions/buildSpacePermix';
import { buildUserPermix } from '#/lib/permissions/buildUserPermix';
import { findUserWithRelations } from '#/modules/user/services/find';

export type OwnerRef = Pick<
  TokenWithRelations,
  'ownerModel' | 'userId' | 'organizationId' | 'spaceId' | 'organizationUser' | 'spaceUser'
> & { integration?: IntegrationWithOwners | null };

export const ownerPermix = async (
  owner: OwnerRef,
  user: UserWithRelations | null = null,
): Promise<Permix> => {
  switch (owner.ownerModel) {
    case 'User': {
      const ownerUser = user ?? (await findUserWithRelations(owner.userId as string));
      return ownerUser ? buildUserPermix(ownerUser) : createPermissions();
    }
    case 'Organization':
      return buildOrganizationPermix(owner.organizationId as string);
    case 'Space':
      return buildSpacePermix(owner.spaceId as string);
    case 'OrganizationUser':
      return buildMembershipPermix('db:organizationUser', owner.organizationUser);
    case 'SpaceUser':
      return buildMembershipPermix('db:spaceUser', owner.spaceUser);
    case 'Integration':
      return owner.integration ? buildIntegrationPermix(owner.integration) : createPermissions();
  }
};

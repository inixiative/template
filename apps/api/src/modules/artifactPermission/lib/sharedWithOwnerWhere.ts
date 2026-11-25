/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import type { OwnerRef } from '#/modules/artifact/lib/artifactOwner';

export const sharedWithOwnerWhere = (owner: OwnerRef): Prisma.ArtifactPermissionWhereInput => {
  const now = new Date();
  const directGrantee: Prisma.ArtifactPermissionWhereInput =
    owner.ownerModel === 'User'
      ? { granteeModel: 'User', granteeUserId: owner.userId! }
      : owner.ownerModel === 'Organization'
        ? { granteeModel: 'Organization', granteeOrganizationId: owner.organizationId! }
        : owner.ownerModel === 'Space'
          ? { granteeModel: 'Space', granteeSpaceId: owner.spaceId! }
          : owner.ownerModel === 'OrganizationUser'
            ? {
                granteeModel: 'OrganizationUser',
                granteeOrganizationId: owner.organizationId!,
                granteeUserId: owner.userId!,
              }
            : {
                granteeModel: 'SpaceUser',
                granteeOrganizationId: owner.organizationId!,
                granteeSpaceId: owner.spaceId!,
                granteeUserId: owner.userId!,
              };

  const customerRelGrantee: Prisma.ArtifactPermissionWhereInput | null =
    owner.ownerModel === 'User'
      ? {
          granteeModel: 'CustomerRelationship',
          granteeCustomerRelationship: {
            customerModel: 'User',
            customerUserId: owner.userId!,
            deletedAt: null,
          },
        }
      : owner.ownerModel === 'Organization'
        ? {
            granteeModel: 'CustomerRelationship',
            granteeCustomerRelationship: {
              customerModel: 'Organization',
              customerOrganizationId: owner.organizationId!,
              deletedAt: null,
            },
          }
        : owner.ownerModel === 'Space'
          ? {
              granteeModel: 'CustomerRelationship',
              granteeCustomerRelationship: {
                customerModel: 'Space',
                customerSpaceId: owner.spaceId!,
                deletedAt: null,
              },
            }
          : null;

  return {
    AND: [
      { OR: customerRelGrantee ? [directGrantee, customerRelGrantee] : [directGrantee] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { artifact: { deletedAt: null } },
    ],
  };
};

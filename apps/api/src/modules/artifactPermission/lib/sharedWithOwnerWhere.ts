/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Prisma } from '@template/db';
import { db } from '@template/db';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { paginate } from '#/lib/prisma/paginate';
import type { BracketQueryRecord } from '#/lib/utils/parseBracketNotation';
import type { OwnerRef } from '#/modules/artifact/lib/artifactOwner';

const granteeRecordForOwner = (owner: OwnerRef): Record<string, unknown> => ({
  id: '',
  granteeModel: owner.ownerModel,
  granteeUserId: owner.userId ?? null,
  granteeOrganizationId: owner.organizationId ?? null,
  granteeSpaceId: owner.spaceId ?? null,
  granteeCustomerRelationshipId: null,
});

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
      { deletedAt: null },
      { OR: customerRelGrantee ? [directGrantee, customerRelGrantee] : [directGrantee] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { artifact: { deletedAt: null } },
    ],
  };
};

export const paginateSharedArtifactPermissions = async (
  c: ValidatedContext<
    'query',
    {
      page?: number;
      pageSize?: number;
      search?: string;
      searchFields?: BracketQueryRecord;
      orderBy?: string[];
    }
  >,
  owner: OwnerRef,
) => {
  if (
    !(await holdsOnRecord(
      c.get('permix'),
      'artifactPermission',
      granteeRecordForOwner(owner),
      'read',
    ))
  ) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
  const hasOrderBy = Boolean(validatedQuery(c).orderBy?.length);
  return paginate(c, db.artifactPermission, {
    where: sharedWithOwnerWhere(owner),
    include: { artifact: true },
    ...(hasOrderBy ? {} : { orderBy: { createdAt: 'desc' } }),
  });
};

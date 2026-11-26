/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import {
  BIND_NAME_BY_OWNER_MODEL,
  isBindableOwnerModel,
  type Prisma,
  polymorphicKeyColumnOrThrow,
  polymorphicKeyColumns,
} from '@template/db';
import type { Context } from 'hono';
import type { ValidatedContext } from '#/lib/context/validatedRequestData';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { paginate } from '#/lib/prisma/paginate';
import { defaultOrderBy } from '#/modules/artifact/queries/ownerArtifactsQuery';
import {
  contextArtifactOwner,
  type OwnerRef,
  ownerColumns,
} from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

const GRANTEE_KEY_TO_OWNER_FIELD = {
  granteeUserId: 'userId',
  granteeOrganizationId: 'organizationId',
  granteeSpaceId: 'spaceId',
} as const;

const directGranteeWhere = (owner: OwnerRef): Prisma.ArtifactPermissionWhereInput => {
  const columns = ownerColumns(owner);
  const keys = polymorphicKeyColumns('ArtifactPermission', 'granteeModel', owner.ownerModel);
  const fields = Object.fromEntries(
    keys.map((key) => [
      key,
      columns[GRANTEE_KEY_TO_OWNER_FIELD[key as keyof typeof GRANTEE_KEY_TO_OWNER_FIELD]]!,
    ]),
  );
  return { granteeModel: owner.ownerModel, ...fields } as Prisma.ArtifactPermissionWhereInput;
};

const granteeRecordForOwner = (owner: OwnerRef): Record<string, unknown> => ({
  id: '',
  granteeModel: owner.ownerModel,
  granteeUserId: owner.userId ?? null,
  granteeOrganizationId: owner.organizationId ?? null,
  granteeSpaceId: owner.spaceId ?? null,
  granteeCustomerRelationshipId: null,
});

const validateCanReadSharedArtifactPermissions = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
): Promise<void> => {
  const allowed = await holdsOnRecord(
    c.get('permix'),
    'artifactPermission',
    granteeRecordForOwner(owner),
    'read',
  );
  if (!allowed) throw makeError({ status: 403, message: 'Forbidden' });
};

const sharedWithOwnerWhere = (owner: OwnerRef): Prisma.ArtifactPermissionWhereInput => {
  const now = new Date();
  const directGrantee = directGranteeWhere(owner);
  const ownerIdField = isBindableOwnerModel(owner.ownerModel)
    ? BIND_NAME_BY_OWNER_MODEL[owner.ownerModel]
    : null;
  const customerRelationshipGrantee: Prisma.ArtifactPermissionWhereInput | null =
    isBindableOwnerModel(owner.ownerModel) && ownerIdField
      ? {
          granteeModel: 'CustomerRelationship',
          granteeCustomerRelationship: {
            customerModel: owner.ownerModel,
            [polymorphicKeyColumnOrThrow(
              'CustomerRelationship',
              'customerModel',
              owner.ownerModel,
            )]: ownerColumns(owner)[ownerIdField]!,
            deletedAt: null,
          },
        }
      : null;

  return {
    AND: [
      { deletedAt: null },
      {
        OR: customerRelationshipGrantee
          ? [directGrantee, customerRelationshipGrantee]
          : [directGrantee],
      },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { artifact: { deletedAt: null } },
    ],
  };
};

export const paginateOwnerArtifactPermissions = async (
  c: ValidatedContext<'query', { orderBy?: string[] }>,
) => {
  const db = c.get('db');
  const owner = contextArtifactOwner(c);
  await validateCanReadSharedArtifactPermissions(c, owner);
  return paginate(c, db.artifactPermission, {
    where: sharedWithOwnerWhere(owner),
    include: { artifact: true },
    orderBy: defaultOrderBy(c, { createdAt: 'desc' as const }),
  });
};

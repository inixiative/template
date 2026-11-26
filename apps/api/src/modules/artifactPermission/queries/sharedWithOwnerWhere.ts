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
import type { ValidatedContext } from '#/lib/context/validatedRequestData';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { defaultOrderBy } from '#/modules/artifact/queries/ownerArtifactsQuery';
import {
  contextArtifactOwner,
  type OwnerRef,
  ownerColumns,
} from '#/modules/artifact/services/artifactOwner';

const GRANTEE_KEY_TO_OWNER_FIELD = {
  granteeUserId: 'userId',
  granteeOrganizationId: 'organizationId',
  granteeSpaceId: 'spaceId',
} as const;

const sharedWithOwnerWhere = (owner: OwnerRef): Prisma.ArtifactPermissionWhereInput => {
  const now = new Date();
  const columns = ownerColumns(owner);
  const directGrantee = {
    granteeModel: owner.ownerModel,
    ...Object.fromEntries(
      polymorphicKeyColumns('ArtifactPermission', 'granteeModel', owner.ownerModel).map((key) => [
        key,
        columns[GRANTEE_KEY_TO_OWNER_FIELD[key as keyof typeof GRANTEE_KEY_TO_OWNER_FIELD]]!,
      ]),
    ),
  } as Prisma.ArtifactPermissionWhereInput;

  const granteeBranches: Prisma.ArtifactPermissionWhereInput[] = [directGrantee];
  if (isBindableOwnerModel(owner.ownerModel)) {
    granteeBranches.push({
      granteeModel: 'CustomerRelationship',
      granteeCustomerRelationship: {
        customerModel: owner.ownerModel,
        [polymorphicKeyColumnOrThrow('CustomerRelationship', 'customerModel', owner.ownerModel)]:
          columns[BIND_NAME_BY_OWNER_MODEL[owner.ownerModel]]!,
      },
    });
  }

  return {
    AND: [{ OR: granteeBranches }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
  };
};

export const ownerArtifactPermissionsQuery = async (
  c: ValidatedContext<'query', { orderBy?: string[] }>,
) => {
  const owner = contextArtifactOwner(c);
  const allowed = await holdsOnRecord(
    c.get('permix'),
    'artifactPermission',
    {
      id: '',
      granteeModel: owner.ownerModel,
      granteeUserId: owner.userId ?? null,
      granteeOrganizationId: owner.organizationId ?? null,
      granteeSpaceId: owner.spaceId ?? null,
      granteeCustomerRelationshipId: null,
    },
    'read',
  );
  if (!allowed) throw makeError({ status: 403, message: 'Forbidden' });
  return {
    where: sharedWithOwnerWhere(owner),
    include: { artifact: true },
    orderBy: defaultOrderBy(c, { createdAt: 'desc' as const }),
  };
};

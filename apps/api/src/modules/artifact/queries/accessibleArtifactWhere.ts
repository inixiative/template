/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Prisma } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import {
  accessibleArtifactGranteeIds,
  accessibleArtifactOwnerIds,
  directEntitledIds,
  STANDARD_ACTIONS_IMPLYING,
} from '@template/permissions';
import type { Permix } from '@template/permissions/client';
import type { Context } from 'hono';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

const callerGranteeClauses = (permix: Permix): Prisma.ArtifactPermissionWhereInput[] => {
  const {
    readableUserIds,
    manageableUserIds,
    readableOrganizationIds,
    ownedOrganizationIds,
    readableSpaceIds,
    operableOrganizationUserIds,
    operableSpaceUserIds,
  } = accessibleArtifactGranteeIds(permix);

  const clauses: Prisma.ArtifactPermissionWhereInput[] = [];

  if (readableUserIds.length > 0) {
    clauses.push({ granteeModel: 'User', granteeUserId: { in: readableUserIds } });
  }
  if (readableOrganizationIds.length > 0) {
    clauses.push({
      granteeModel: 'Organization',
      granteeOrganizationId: { in: readableOrganizationIds },
    });
  }
  if (readableSpaceIds.length > 0) {
    clauses.push({ granteeModel: 'Space', granteeSpaceId: { in: readableSpaceIds } });
  }
  if (ownedOrganizationIds.length > 0) {
    clauses.push({
      granteeModel: 'Space',
      granteeSpace: { organizationId: { in: ownedOrganizationIds } },
    });
  }
  if (operableOrganizationUserIds.length > 0) {
    clauses.push({
      granteeModel: 'OrganizationUser',
      granteeOrganizationUser: { id: { in: operableOrganizationUserIds } },
    });
  }
  if (manageableUserIds.length > 0) {
    clauses.push({
      granteeModel: 'OrganizationUser',
      granteeUserId: { in: manageableUserIds },
    });
  }
  if (operableSpaceUserIds.length > 0) {
    clauses.push({
      granteeModel: 'SpaceUser',
      granteeSpaceUser: { id: { in: operableSpaceUserIds } },
    });
  }
  if (manageableUserIds.length > 0) {
    clauses.push({
      granteeModel: 'SpaceUser',
      granteeUserId: { in: manageableUserIds },
    });
  }

  const customerClauses: Prisma.CustomerRelationshipWhereInput[] = [];
  if (readableUserIds.length > 0) {
    customerClauses.push({ customerModel: 'User', customerUserId: { in: readableUserIds } });
  }
  if (readableOrganizationIds.length > 0) {
    customerClauses.push({
      customerModel: 'Organization',
      customerOrganizationId: { in: readableOrganizationIds },
    });
  }
  if (readableSpaceIds.length > 0) {
    customerClauses.push({ customerModel: 'Space', customerSpaceId: { in: readableSpaceIds } });
  }
  if (ownedOrganizationIds.length > 0) {
    customerClauses.push({
      customerModel: 'Space',
      customerSpace: { organizationId: { in: ownedOrganizationIds } },
    });
  }
  if (customerClauses.length > 0) {
    clauses.push({
      granteeModel: 'CustomerRelationship',
      granteeCustomerRelationship: { deletedAt: null, OR: customerClauses },
    });
  }

  return clauses;
};

export const effectiveGrantWhere = (
  permix: Permix,
  roles?: Role[],
): Prisma.ArtifactWhereInput | null => {
  const granteeClauses = callerGranteeClauses(permix);
  if (granteeClauses.length === 0) return null;
  const now = new Date();
  return {
    artifactEffectivePermissions: {
      some: {
        artifactPermission: {
          deletedAt: null,
          ...(roles ? { role: { in: roles } } : {}),
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: granteeClauses }],
        },
      },
    },
  };
};

// why: naive SQL reflection of artifactResourcePermission.read until AUTH-013 compiles ReBAC into SQL.
export const accessibleArtifactWhereForOwner = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
): Promise<Prisma.ArtifactWhereInput | null> => {
  const permix = c.get('permix');
  if (permix.isSuperadmin()) return null;

  const ownerFields = ownerColumns(owner);
  if (
    await holdsOnRecord(
      permix,
      'artifact',
      { id: '', effectiveAccess: 'private', ...ownerFields },
      'read',
    )
  ) {
    return null;
  }

  const [canReadPublic, canReadTenant] = await Promise.all([
    holdsOnRecord(
      permix,
      'artifact',
      { id: '', effectiveAccess: 'public', ...ownerFields },
      'read',
    ),
    holdsOnRecord(
      permix,
      'artifact',
      { id: '', effectiveAccess: 'tenant', ...ownerFields },
      'read',
    ),
  ]);
  const {
    entitlements: artifactEntitlements,
    directIds: directArtifactIds,
    hasBroadEntitlement,
  } = directEntitledIds(permix, 'db:Artifact', STANDARD_ACTIONS_IMPLYING.read);
  if (hasBroadEntitlement) {
    // Narrowed where-scoped db:Artifact.read entitlement anchored above the artifact: let page post-filter decide.
    return null;
  }

  const orClauses: Prisma.ArtifactWhereInput[] = [];
  if (canReadPublic) orClauses.push({ effectiveAccess: 'public' });
  if (canReadTenant) orClauses.push({ effectiveAccess: 'tenant' });
  if (canReadPublic || artifactEntitlements.length > 0) {
    const grantClause = effectiveGrantWhere(permix);
    if (grantClause) orClauses.push(grantClause);
  }
  if (directArtifactIds.length > 0) {
    orClauses.push({ id: { in: directArtifactIds } });
  }

  return orClauses.length > 0 ? { OR: orClauses } : { id: { in: [] } };
};

export const accessibleAnyArtifactWhere = async (
  c: Context<AppEnv>,
): Promise<Prisma.ArtifactWhereInput | null> => {
  const permix = c.get('permix');
  if (permix.isSuperadmin()) return null;

  const canReadPublic = await holdsOnRecord(
    permix,
    'artifact',
    { id: '', effectiveAccess: 'public', ownerModel: 'User', userId: '' },
    'read',
  );
  const {
    entitlements: artifactEntitlements,
    directIds: directArtifactIds,
    hasBroadEntitlement,
  } = directEntitledIds(permix, 'db:Artifact', STANDARD_ACTIONS_IMPLYING.read);
  if (hasBroadEntitlement) return null;
  if (!canReadPublic && artifactEntitlements.length === 0) return { id: { in: [] } };

  const orClauses: Prisma.ArtifactWhereInput[] = [];
  if (canReadPublic) orClauses.push({ effectiveAccess: 'public' });
  if (directArtifactIds.length > 0) orClauses.push({ id: { in: directArtifactIds } });

  const grantClause = effectiveGrantWhere(permix);
  if (grantClause) orClauses.push(grantClause);

  const {
    readableUserIds,
    manageableUserIds,
    readableOrganizationIds,
    manageableOrganizationIds,
    ownedOrganizationIds,
    readableSpaceIds,
    manageableSpaceIds,
    ownedSpaceIds,
    operableOrganizationUserIds,
    operableSpaceUserIds,
  } = accessibleArtifactOwnerIds(permix);

  if (readableUserIds.length > 0) {
    orClauses.push({ ownerModel: 'User', userId: { in: readableUserIds } });
  }
  if (manageableOrganizationIds.length > 0) {
    orClauses.push({
      ownerModel: 'Organization',
      organizationId: { in: manageableOrganizationIds },
    });
  }
  if (readableOrganizationIds.length > 0) {
    orClauses.push({
      ownerModel: { in: ['Organization', 'OrganizationUser'] },
      organizationId: { in: readableOrganizationIds },
      effectiveAccess: 'tenant',
    });
  }
  if (ownedOrganizationIds.length > 0) {
    orClauses.push(
      { ownerModel: 'Space', organizationId: { in: ownedOrganizationIds } },
      { ownerModel: 'OrganizationUser', organizationId: { in: ownedOrganizationIds } },
      { ownerModel: 'SpaceUser', organizationId: { in: ownedOrganizationIds } },
    );
  }
  if (manageableSpaceIds.length > 0) {
    orClauses.push({ ownerModel: 'Space', spaceId: { in: manageableSpaceIds } });
  }
  if (readableSpaceIds.length > 0) {
    orClauses.push({
      ownerModel: { in: ['Space', 'SpaceUser'] },
      spaceId: { in: readableSpaceIds },
      effectiveAccess: 'tenant',
    });
  }
  if (ownedSpaceIds.length > 0) {
    orClauses.push({ ownerModel: 'SpaceUser', spaceId: { in: ownedSpaceIds } });
  }
  if (operableOrganizationUserIds.length > 0) {
    orClauses.push({
      ownerModel: 'OrganizationUser',
      organizationUser: { id: { in: operableOrganizationUserIds } },
    });
  }
  if (manageableUserIds.length > 0) {
    orClauses.push(
      { ownerModel: 'OrganizationUser', userId: { in: manageableUserIds } },
      { ownerModel: 'SpaceUser', userId: { in: manageableUserIds } },
    );
  }
  if (operableSpaceUserIds.length > 0) {
    orClauses.push({
      ownerModel: 'SpaceUser',
      spaceUser: { id: { in: operableSpaceUserIds } },
    });
  }

  return orClauses.length > 0 ? { OR: orClauses } : { id: { in: [] } };
};

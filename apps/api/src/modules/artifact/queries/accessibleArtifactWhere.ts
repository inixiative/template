/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Prisma } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import {
  directEntitledIds,
  permixIdsWithAction,
  STANDARD_ACTIONS_IMPLYING,
} from '@template/permissions';
import type { Permix } from '@template/permissions/client';
import type { Context } from 'hono';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import {
  type OwnedArtifact,
  type OwnerRef,
  ownerColumns,
} from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

type CallerPrincipalIds = {
  readableUserIds: string[];
  manageableUserIds: string[];
  readableOrganizationIds: string[];
  manageableOrganizationIds: string[];
  ownedOrganizationIds: string[];
  readableSpaceIds: string[];
  manageableSpaceIds: string[];
  ownedSpaceIds: string[];
  operableOrganizationUserIds: string[];
  operableSpaceUserIds: string[];
};

const callerPrincipalIds = (permix: Permix): CallerPrincipalIds => ({
  readableUserIds: permixIdsWithAction(permix, 'db:User', 'read'),
  manageableUserIds: permixIdsWithAction(permix, 'db:User', 'manage'),
  readableOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'read'),
  manageableOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'manage'),
  ownedOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'own'),
  readableSpaceIds: permixIdsWithAction(permix, 'db:Space', 'read'),
  manageableSpaceIds: permixIdsWithAction(permix, 'db:Space', 'manage'),
  ownedSpaceIds: permixIdsWithAction(permix, 'db:Space', 'own'),
  operableOrganizationUserIds: permixIdsWithAction(permix, 'db:OrganizationUser', 'operate'),
  operableSpaceUserIds: permixIdsWithAction(permix, 'db:SpaceUser', 'operate'),
});

const principalClauses = (
  prefix: 'grantee' | 'customer',
  ids: CallerPrincipalIds,
): Record<string, unknown>[] => {
  const clauses: Record<string, unknown>[] = [];
  if (ids.readableUserIds.length > 0) {
    clauses.push({ [`${prefix}Model`]: 'User', [`${prefix}UserId`]: { in: ids.readableUserIds } });
  }
  if (ids.readableOrganizationIds.length > 0) {
    clauses.push({
      [`${prefix}Model`]: 'Organization',
      [`${prefix}OrganizationId`]: { in: ids.readableOrganizationIds },
    });
  }
  if (ids.readableSpaceIds.length > 0) {
    clauses.push({
      [`${prefix}Model`]: 'Space',
      [`${prefix}SpaceId`]: { in: ids.readableSpaceIds },
    });
  }
  if (ids.ownedOrganizationIds.length > 0) {
    clauses.push({
      [`${prefix}Model`]: 'Space',
      [`${prefix}Space`]: { organizationId: { in: ids.ownedOrganizationIds } },
    });
  }
  return clauses;
};

const callerGranteeClauses = (ids: CallerPrincipalIds): Prisma.ArtifactPermissionWhereInput[] => {
  const clauses = principalClauses('grantee', ids) as Prisma.ArtifactPermissionWhereInput[];
  if (ids.operableOrganizationUserIds.length > 0) {
    clauses.push({
      granteeModel: 'OrganizationUser',
      granteeOrganizationUser: { id: { in: ids.operableOrganizationUserIds } },
    });
  }
  if (ids.operableSpaceUserIds.length > 0) {
    clauses.push({
      granteeModel: 'SpaceUser',
      granteeSpaceUser: { id: { in: ids.operableSpaceUserIds } },
    });
  }
  if (ids.manageableUserIds.length > 0) {
    clauses.push({
      granteeModel: { in: ['OrganizationUser', 'SpaceUser'] },
      granteeUserId: { in: ids.manageableUserIds },
    });
  }
  const customerClauses = principalClauses(
    'customer',
    ids,
  ) as Prisma.CustomerRelationshipWhereInput[];
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
  ids?: CallerPrincipalIds,
): Prisma.ArtifactWhereInput | null => {
  const granteeClauses = callerGranteeClauses(ids ?? callerPrincipalIds(permix));
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

export type OwnerArtifactAccessProbe = {
  canReadPrivate: boolean;
  canReadPublic: boolean;
  canReadTenant: boolean;
};

export const probeOwnerArtifactAccess = async (
  permix: Permix,
  ownerFields: OwnedArtifact,
): Promise<OwnerArtifactAccessProbe> => {
  const [canReadPrivate, canReadPublic, canReadTenant] = await Promise.all([
    holdsOnRecord(
      permix,
      'artifact',
      { id: '', effectiveAccess: 'private', ...ownerFields },
      'read',
    ),
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
  return { canReadPrivate, canReadPublic, canReadTenant };
};

// why: naive SQL reflection of artifactResourcePermission.read until AUTH-013 compiles ReBAC into SQL.
export const accessibleArtifactWhereForOwner = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
  probed?: OwnerArtifactAccessProbe,
): Promise<Prisma.ArtifactWhereInput | null> => {
  const permix = c.get('permix');
  if (permix.isSuperadmin()) return null;

  const { canReadPrivate, canReadPublic, canReadTenant } =
    probed ?? (await probeOwnerArtifactAccess(permix, ownerColumns(owner)));
  if (canReadPrivate) return null;

  const {
    entitlements: artifactEntitlements,
    directIds: directArtifactIds,
    hasBroadEntitlement,
  } = directEntitledIds(permix, 'db:Artifact', STANDARD_ACTIONS_IMPLYING.read);
  if (hasBroadEntitlement) return null;

  const orClauses: Prisma.ArtifactWhereInput[] = [];
  if (canReadPublic) orClauses.push({ effectiveAccess: 'public' });
  if (canReadTenant) orClauses.push({ effectiveAccess: 'tenant' });
  if (canReadPublic || artifactEntitlements.length > 0) {
    const grantClause = effectiveGrantWhere(permix);
    if (grantClause) orClauses.push(grantClause);
  }
  if (directArtifactIds.length > 0) orClauses.push({ id: { in: directArtifactIds } });

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

  const ids = callerPrincipalIds(permix);
  const orClauses: Prisma.ArtifactWhereInput[] = [];
  if (canReadPublic) orClauses.push({ effectiveAccess: 'public' });
  if (directArtifactIds.length > 0) orClauses.push({ id: { in: directArtifactIds } });

  const grantClause = effectiveGrantWhere(permix, undefined, ids);
  if (grantClause) orClauses.push(grantClause);

  if (ids.readableUserIds.length > 0) {
    orClauses.push({ ownerModel: 'User', userId: { in: ids.readableUserIds } });
  }
  if (ids.manageableOrganizationIds.length > 0) {
    orClauses.push({
      ownerModel: 'Organization',
      organizationId: { in: ids.manageableOrganizationIds },
    });
  }
  if (ids.readableOrganizationIds.length > 0) {
    orClauses.push({
      ownerModel: { in: ['Organization', 'OrganizationUser'] },
      organizationId: { in: ids.readableOrganizationIds },
      effectiveAccess: 'tenant',
    });
  }
  if (ids.ownedOrganizationIds.length > 0) {
    orClauses.push({
      ownerModel: { in: ['Space', 'OrganizationUser', 'SpaceUser'] },
      organizationId: { in: ids.ownedOrganizationIds },
    });
  }
  if (ids.manageableSpaceIds.length > 0) {
    orClauses.push({ ownerModel: 'Space', spaceId: { in: ids.manageableSpaceIds } });
  }
  if (ids.readableSpaceIds.length > 0) {
    orClauses.push({
      ownerModel: { in: ['Space', 'SpaceUser'] },
      spaceId: { in: ids.readableSpaceIds },
      effectiveAccess: 'tenant',
    });
  }
  if (ids.ownedSpaceIds.length > 0) {
    orClauses.push({ ownerModel: 'SpaceUser', spaceId: { in: ids.ownedSpaceIds } });
  }
  if (ids.operableOrganizationUserIds.length > 0) {
    orClauses.push({
      ownerModel: 'OrganizationUser',
      organizationUser: { id: { in: ids.operableOrganizationUserIds } },
    });
  }
  if (ids.manageableUserIds.length > 0) {
    orClauses.push({
      ownerModel: { in: ['OrganizationUser', 'SpaceUser'] },
      userId: { in: ids.manageableUserIds },
    });
  }
  if (ids.operableSpaceUserIds.length > 0) {
    orClauses.push({
      ownerModel: 'SpaceUser',
      spaceUser: { id: { in: ids.operableSpaceUserIds } },
    });
  }

  return orClauses.length > 0 ? { OR: orClauses } : { id: { in: [] } };
};

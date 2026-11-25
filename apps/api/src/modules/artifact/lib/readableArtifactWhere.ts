/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Prisma } from '@template/db';
import type { Action, Permix } from '@template/permissions/client';
import type { Context } from 'hono';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/lib/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

const visibilityWhere = (access: 'public' | 'tenant'): Prisma.ArtifactWhereInput[] => [
  { access },
  {
    access: 'inherit',
    ancestors: { some: { inheritsAccess: true, ancestorArtifact: { access } } },
  },
];

const ACTIONS_IMPLYING: Record<'own' | 'manage' | 'operate' | 'read', readonly Action[]> = {
  own: ['own'],
  manage: ['own', 'manage'],
  operate: ['own', 'manage', 'operate'],
  read: ['own', 'manage', 'operate', 'read'],
};

const safePermixTable = (permix: Permix): Record<string, Record<string, boolean>> | null => {
  try {
    return permix.getJSON();
  } catch {
    return null;
  }
};

// Reads the caller's already-resolved effective permissions (covering users, full/capped/entitlement-only
// tokens, member-seat tokens, integration tokens, and spoofing) without duplicating ownerPermissions.
const permixIds = (
  permix: Permix,
  resource: string,
  action: 'own' | 'manage' | 'operate' | 'read',
): string[] => {
  const ids = new Set<string>();
  const covering = ACTIONS_IMPLYING[action];
  const prefix = `${resource}:`;
  const table = safePermixTable(permix);
  if (table) {
    for (const [key, actions] of Object.entries(table)) {
      if (key.startsWith(prefix) && covering.some((candidate) => actions[candidate] === true)) {
        ids.add(key.slice(prefix.length));
      }
    }
  }
  for (const candidate of covering) {
    for (const entitlement of permix.entitlements(resource, candidate)) {
      if (entitlement.anchor.resource === resource && entitlement.anchor.id) {
        ids.add(entitlement.anchor.id);
      }
    }
  }
  return [...ids];
};

const callerGranteeClauses = (permix: Permix): Prisma.ArtifactPermissionWhereInput[] => {
  const readableUserIds = permixIds(permix, 'db:User', 'read');
  const manageableUserIds = permixIds(permix, 'db:User', 'manage');
  const readableOrgIds = permixIds(permix, 'db:Organization', 'read');
  const ownedOrgIds = permixIds(permix, 'db:Organization', 'own');
  const readableSpaceIds = permixIds(permix, 'db:Space', 'read');
  const operableOrgUserIds = permixIds(permix, 'db:OrganizationUser', 'operate');
  const operableSpaceUserIds = permixIds(permix, 'db:SpaceUser', 'operate');

  const clauses: Prisma.ArtifactPermissionWhereInput[] = [];

  if (readableUserIds.length > 0) {
    clauses.push({ granteeModel: 'User', granteeUserId: { in: readableUserIds } });
  }
  if (readableOrgIds.length > 0) {
    clauses.push({ granteeModel: 'Organization', granteeOrganizationId: { in: readableOrgIds } });
  }
  if (readableSpaceIds.length > 0) {
    clauses.push({ granteeModel: 'Space', granteeSpaceId: { in: readableSpaceIds } });
  }
  if (ownedOrgIds.length > 0) {
    clauses.push({
      granteeModel: 'Space',
      granteeSpace: { organizationId: { in: ownedOrgIds } },
    });
  }
  if (operableOrgUserIds.length > 0) {
    clauses.push({
      granteeModel: 'OrganizationUser',
      granteeOrganizationUser: { id: { in: operableOrgUserIds } },
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
  if (readableOrgIds.length > 0) {
    customerClauses.push({
      customerModel: 'Organization',
      customerOrganizationId: { in: readableOrgIds },
    });
  }
  if (readableSpaceIds.length > 0) {
    customerClauses.push({ customerModel: 'Space', customerSpaceId: { in: readableSpaceIds } });
  }
  if (ownedOrgIds.length > 0) {
    customerClauses.push({
      customerModel: 'Space',
      customerSpace: { organizationId: { in: ownedOrgIds } },
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

const effectiveGrantWhere = (permix: Permix): Prisma.ArtifactWhereInput | null => {
  const granteeClauses = callerGranteeClauses(permix);
  if (granteeClauses.length === 0) return null;
  const now = new Date();
  return {
    effectivePermissions: {
      some: {
        permission: {
          deletedAt: null,
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: granteeClauses }],
        },
      },
    },
  };
};

// why: naive SQL reflection of artifactResourcePermission.read until AUTH-013 compiles ReBAC into SQL.
export const readableArtifactWhereForOwner = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
): Promise<Prisma.ArtifactWhereInput | null> => {
  const permix = c.get('permix');
  if (permix.isSuperadmin()) return null;

  const ownerFields = ownerColumns(owner);
  if (
    await holdsOnRecord(permix, 'artifact', { id: '', access: 'private', ...ownerFields }, 'read')
  ) {
    return null;
  }

  const [canReadPublic, canReadTenant] = await Promise.all([
    holdsOnRecord(permix, 'artifact', { id: '', access: 'public', ...ownerFields }, 'read'),
    holdsOnRecord(permix, 'artifact', { id: '', access: 'tenant', ...ownerFields }, 'read'),
  ]);
  const artifactEntitlements = permix.entitlements('db:Artifact', 'read');
  const directArtifactIds = artifactEntitlements.flatMap((ent) =>
    ent.anchor.resource === 'db:Artifact' && ent.anchor.id ? [ent.anchor.id] : [],
  );

  const orClauses: Prisma.ArtifactWhereInput[] = [];
  if (canReadPublic) orClauses.push(...visibilityWhere('public'));
  if (canReadTenant) orClauses.push(...visibilityWhere('tenant'));
  if (canReadPublic || artifactEntitlements.length > 0) {
    const grantClause = effectiveGrantWhere(permix);
    if (grantClause) orClauses.push(grantClause);
  }
  if (directArtifactIds.length > 0) {
    orClauses.push({ id: { in: directArtifactIds } });
  } else if (!canReadPublic && artifactEntitlements.length > 0) {
    // Narrowed where-scoped db:Artifact.read entitlement anchored above the artifact: let page post-filter decide.
    return null;
  }

  return orClauses.length > 0 ? { OR: orClauses } : { id: { in: [] } };
};

export const readableAnyArtifactWhere = async (
  c: Context<AppEnv>,
): Promise<Prisma.ArtifactWhereInput | null> => {
  const permix = c.get('permix');
  if (permix.isSuperadmin()) return null;

  const canReadPublic = await holdsOnRecord(
    permix,
    'artifact',
    { id: '', access: 'public', ownerModel: 'User', userId: '' },
    'read',
  );
  const artifactEntitlements = permix.entitlements('db:Artifact', 'read');
  if (!canReadPublic && artifactEntitlements.length === 0) return { id: { in: [] } };

  const orClauses: Prisma.ArtifactWhereInput[] = [];
  if (canReadPublic) orClauses.push(...visibilityWhere('public'));

  const directArtifactIds = artifactEntitlements.flatMap((ent) =>
    ent.anchor.resource === 'db:Artifact' && ent.anchor.id ? [ent.anchor.id] : [],
  );
  if (directArtifactIds.length > 0) {
    orClauses.push({ id: { in: directArtifactIds } });
  } else if (!canReadPublic && artifactEntitlements.length > 0) {
    return null;
  }

  const grantClause = effectiveGrantWhere(permix);
  if (grantClause) orClauses.push(grantClause);

  const readableUserIds = permixIds(permix, 'db:User', 'read');
  const manageableUserIds = permixIds(permix, 'db:User', 'manage');
  const readableOrgIds = permixIds(permix, 'db:Organization', 'read');
  const manageableOrgIds = permixIds(permix, 'db:Organization', 'manage');
  const ownedOrgIds = permixIds(permix, 'db:Organization', 'own');
  const readableSpaceIds = permixIds(permix, 'db:Space', 'read');
  const manageableSpaceIds = permixIds(permix, 'db:Space', 'manage');
  const ownedSpaceIds = permixIds(permix, 'db:Space', 'own');
  const operableOrgUserIds = permixIds(permix, 'db:OrganizationUser', 'operate');
  const operableSpaceUserIds = permixIds(permix, 'db:SpaceUser', 'operate');

  if (readableUserIds.length > 0) {
    orClauses.push({ ownerModel: 'User', userId: { in: readableUserIds } });
  }
  if (manageableOrgIds.length > 0) {
    orClauses.push({ ownerModel: 'Organization', organizationId: { in: manageableOrgIds } });
  }
  if (readableOrgIds.length > 0) {
    orClauses.push({
      ownerModel: { in: ['Organization', 'OrganizationUser'] },
      organizationId: { in: readableOrgIds },
      OR: visibilityWhere('tenant'),
    });
  }
  if (ownedOrgIds.length > 0) {
    orClauses.push(
      { ownerModel: 'Space', organizationId: { in: ownedOrgIds } },
      { ownerModel: 'OrganizationUser', organizationId: { in: ownedOrgIds } },
      { ownerModel: 'SpaceUser', organizationId: { in: ownedOrgIds } },
    );
  }
  if (manageableSpaceIds.length > 0) {
    orClauses.push({ ownerModel: 'Space', spaceId: { in: manageableSpaceIds } });
  }
  if (readableSpaceIds.length > 0) {
    orClauses.push({
      ownerModel: { in: ['Space', 'SpaceUser'] },
      spaceId: { in: readableSpaceIds },
      OR: visibilityWhere('tenant'),
    });
  }
  if (ownedSpaceIds.length > 0) {
    orClauses.push({ ownerModel: 'SpaceUser', spaceId: { in: ownedSpaceIds } });
  }
  if (operableOrgUserIds.length > 0) {
    orClauses.push({
      ownerModel: 'OrganizationUser',
      organizationUser: { id: { in: operableOrgUserIds } },
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

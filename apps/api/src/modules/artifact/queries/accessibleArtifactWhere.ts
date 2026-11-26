/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { hydrate, type Prisma } from '@template/db';
import type { OperateAccess, ReadAccess, Role } from '@template/db/generated/client/enums';
import {
  directEntitledIds,
  ownerPrivateRead,
  permixIdsWithAction,
  STANDARD_ACTIONS_IMPLYING,
} from '@template/permissions';
import type { Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac';
import type { Context } from 'hono';
import {
  type OwnedArtifact,
  type OwnerRef,
  ownerColumns,
} from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

const ownerPrivateReadRule = ownerPrivateRead();

const callerPrincipalIds = (permix: Permix) => ({
  readableUserIds: permixIdsWithAction(permix, 'db:User', 'read'),
  manageableUserIds: permixIdsWithAction(permix, 'db:User', 'manage'),
  readableOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'read'),
  operableOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'operate'),
  manageableOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'manage'),
  ownedOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'own'),
  readableSpaceIds: permixIdsWithAction(permix, 'db:Space', 'read'),
  operableSpaceIds: permixIdsWithAction(permix, 'db:Space', 'operate'),
  manageableSpaceIds: permixIdsWithAction(permix, 'db:Space', 'manage'),
  ownedSpaceIds: permixIdsWithAction(permix, 'db:Space', 'own'),
  operableOrganizationUserIds: permixIdsWithAction(permix, 'db:OrganizationUser', 'operate'),
  operableSpaceUserIds: permixIdsWithAction(permix, 'db:SpaceUser', 'operate'),
});

type CallerPrincipalIds = ReturnType<typeof callerPrincipalIds>;

const nonEmptyClauses = <T>(entries: [string[], T][]): T[] =>
  entries.filter(([ids]) => ids.length > 0).map(([, clause]) => clause);

const principalClauses = (
  prefix: 'grantee' | 'customer',
  ids: CallerPrincipalIds,
): Record<string, unknown>[] =>
  nonEmptyClauses<Record<string, unknown>>([
    [
      ids.readableUserIds,
      { [`${prefix}Model`]: 'User', [`${prefix}UserId`]: { in: ids.readableUserIds } },
    ],
    [
      ids.readableOrganizationIds,
      {
        [`${prefix}Model`]: 'Organization',
        [`${prefix}OrganizationId`]: { in: ids.readableOrganizationIds },
      },
    ],
    [
      ids.readableSpaceIds,
      { [`${prefix}Model`]: 'Space', [`${prefix}SpaceId`]: { in: ids.readableSpaceIds } },
    ],
    [
      ids.ownedOrganizationIds,
      {
        [`${prefix}Model`]: 'Space',
        [`${prefix}Space`]: { organizationId: { in: ids.ownedOrganizationIds } },
      },
    ],
  ]);

const callerGranteeClauses = (ids: CallerPrincipalIds): Prisma.ArtifactPermissionWhereInput[] => {
  const customerClauses = principalClauses(
    'customer',
    ids,
  ) as Prisma.CustomerRelationshipWhereInput[];
  return [
    ...(principalClauses('grantee', ids) as Prisma.ArtifactPermissionWhereInput[]),
    ...nonEmptyClauses<Prisma.ArtifactPermissionWhereInput>([
      [
        ids.operableOrganizationUserIds,
        {
          granteeModel: 'OrganizationUser',
          granteeOrganizationUser: { id: { in: ids.operableOrganizationUserIds } },
        },
      ],
      [
        ids.operableSpaceUserIds,
        { granteeModel: 'SpaceUser', granteeSpaceUser: { id: { in: ids.operableSpaceUserIds } } },
      ],
      [
        ids.manageableUserIds,
        {
          granteeModel: { in: ['OrganizationUser', 'SpaceUser'] },
          granteeUserId: { in: ids.manageableUserIds },
        },
      ],
    ]),
    ...(customerClauses.length > 0
      ? [
          {
            granteeModel: 'CustomerRelationship' as const,
            granteeCustomerRelationship: { OR: customerClauses },
          },
        ]
      : []),
  ];
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
          ...(roles ? { role: { in: roles } } : {}),
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: granteeClauses }],
        },
      },
    },
  };
};

export type OwnerArtifactAccessProbe = {
  canOwnerReadPrivate: boolean;
  canReadPrivate: boolean;
  canReadPublic: boolean;
  canReadTenant: boolean;
  canOperateTenant: boolean;
};

export const probeOwnerArtifactAccess = async (
  permix: Permix,
  ownerFields: OwnedArtifact,
): Promise<OwnerArtifactAccessProbe> => {
  const hydrated = await hydrate('artifact', {
    id: '',
    effectiveReadAccess: 'private',
    effectiveOperateAccess: 'private',
    ...ownerFields,
  });
  const probe = (effectiveReadAccess: ReadAccess, effectiveOperateAccess: OperateAccess) =>
    check(permix, 'artifact', { ...hydrated, effectiveReadAccess, effectiveOperateAccess }, 'read');
  return {
    canOwnerReadPrivate: check(permix, 'artifact', hydrated, ownerPrivateReadRule),
    canReadPrivate: probe('private', 'private'),
    canReadPublic: probe('public', 'private'),
    canReadTenant: probe('tenant', 'private'),
    canOperateTenant: probe('private', 'tenant'),
  };
};

// why: naive SQL reflection of artifactResourcePermission.read until INFRA-026 compiles ReBAC into SQL.
export const accessibleArtifactWhereForOwner = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
  probed?: OwnerArtifactAccessProbe,
): Promise<Prisma.ArtifactWhereInput | null> => {
  const permix = c.get('permix');
  if (permix.isSuperadmin()) return null;

  const { canReadPrivate, canReadPublic, canReadTenant, canOperateTenant } =
    probed ?? (await probeOwnerArtifactAccess(permix, ownerColumns(owner)));
  if (canReadPrivate) return null;

  const {
    entitlements: artifactEntitlements,
    directIds: directArtifactIds,
    hasBroadEntitlement,
  } = directEntitledIds(permix, 'db:Artifact', STANDARD_ACTIONS_IMPLYING.read);
  if (hasBroadEntitlement) return null;

  const orClauses: Prisma.ArtifactWhereInput[] = [];
  if (canReadPublic) orClauses.push({ effectiveReadAccess: 'public' });
  if (canReadTenant) orClauses.push({ effectiveReadAccess: 'tenant' });
  if (canOperateTenant) orClauses.push({ effectiveOperateAccess: 'tenant' });
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

  const canReadPublic = check(
    permix,
    'artifact',
    {
      id: '',
      effectiveReadAccess: 'public',
      effectiveOperateAccess: 'private',
      ownerModel: 'User',
      userId: null,
    },
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
  const grantClause = effectiveGrantWhere(permix, undefined, ids);
  const orClauses: Prisma.ArtifactWhereInput[] = [
    ...(canReadPublic ? [{ effectiveReadAccess: 'public' as const }] : []),
    ...(grantClause ? [grantClause] : []),
    ...nonEmptyClauses<Prisma.ArtifactWhereInput>([
      [directArtifactIds, { id: { in: directArtifactIds } }],
      [ids.readableUserIds, { ownerModel: 'User', userId: { in: ids.readableUserIds } }],
      [
        ids.manageableOrganizationIds,
        { ownerModel: 'Organization', organizationId: { in: ids.manageableOrganizationIds } },
      ],
      [
        ids.readableOrganizationIds,
        {
          ownerModel: { in: ['Organization', 'OrganizationUser'] },
          organizationId: { in: ids.readableOrganizationIds },
          effectiveReadAccess: 'tenant',
        },
      ],
      [
        ids.operableOrganizationIds,
        {
          ownerModel: { in: ['Organization', 'OrganizationUser'] },
          organizationId: { in: ids.operableOrganizationIds },
          effectiveOperateAccess: 'tenant',
        },
      ],
      [
        ids.ownedOrganizationIds,
        {
          ownerModel: { in: ['Space', 'OrganizationUser', 'SpaceUser'] },
          organizationId: { in: ids.ownedOrganizationIds },
        },
      ],
      [ids.manageableSpaceIds, { ownerModel: 'Space', spaceId: { in: ids.manageableSpaceIds } }],
      [
        ids.readableSpaceIds,
        {
          ownerModel: { in: ['Space', 'SpaceUser'] },
          spaceId: { in: ids.readableSpaceIds },
          effectiveReadAccess: 'tenant',
        },
      ],
      [
        ids.operableSpaceIds,
        {
          ownerModel: { in: ['Space', 'SpaceUser'] },
          spaceId: { in: ids.operableSpaceIds },
          effectiveOperateAccess: 'tenant',
        },
      ],
      [ids.ownedSpaceIds, { ownerModel: 'SpaceUser', spaceId: { in: ids.ownedSpaceIds } }],
      [
        ids.operableOrganizationUserIds,
        {
          ownerModel: 'OrganizationUser',
          organizationUser: { id: { in: ids.operableOrganizationUserIds } },
        },
      ],
      [
        ids.manageableUserIds,
        {
          ownerModel: { in: ['OrganizationUser', 'SpaceUser'] },
          userId: { in: ids.manageableUserIds },
        },
      ],
      [
        ids.operableSpaceUserIds,
        { ownerModel: 'SpaceUser', spaceUser: { id: { in: ids.operableSpaceUserIds } } },
      ],
    ]),
  ];

  return orClauses.length > 0 ? { OR: orClauses } : { id: { in: [] } };
};

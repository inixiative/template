/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { type ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import { directEntitledIds } from '@template/permissions';
import type { Permix } from '@template/permissions/client';
import type { Context } from 'hono';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import type { BracketQueryRecord } from '#/lib/utils/parseBracketNotation';
import {
  accessibleAnyArtifactWhere,
  accessibleArtifactWhereForOwner,
  effectiveGrantWhere,
} from '#/modules/artifact/queries/accessibleArtifactWhere';
import {
  type OwnedArtifact,
  type OwnerRef,
  ownerColumns,
} from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

export type PlacementWithArtifacts = ArtifactPlacement & {
  artifact: Artifact;
  containerArtifact: Artifact;
};

export const includeArtifactPlacementList = {
  artifact: true,
  containerArtifact: true,
} satisfies Prisma.ArtifactPlacementInclude;

export const defaultArtifactPlacementOrderBy = (
  c: ValidatedContext<'query', { orderBy?: string[] }>,
): Prisma.ArtifactPlacementOrderByWithRelationInput | undefined =>
  validatedQuery(c).orderBy?.length ? undefined : { createdAt: 'desc' };

const isBracketRecord = (value: unknown): value is BracketQueryRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasContainerFilter = (c: Context<AppEnv>): boolean => {
  const query = validatedQuery(
    c as ValidatedContext<'query', { searchFields?: BracketQueryRecord }>,
  );
  const bracketSearchFields = c.get('bracketQuery').searchFields;
  const searchFields = isBracketRecord(bracketSearchFields)
    ? bracketSearchFields
    : query.searchFields;
  if (!searchFields) return false;
  return 'containerArtifactId' in searchFields || 'containerArtifact' in searchFields;
};

const canAccessOwnerPrivatePlacements = async (
  permix: Permix,
  ownerFields: OwnedArtifact,
): Promise<boolean> => {
  if (permix.isSuperadmin()) return true;
  if (
    await holdsOnRecord(
      permix,
      'artifact',
      { id: '', kind: ArtifactKind.root, effectiveAccess: 'private', ...ownerFields },
      'manage',
    )
  ) {
    return true;
  }
  if (ownerFields.ownerModel === 'User' && ownerFields.userId) {
    return holdsOnRecord(permix, 'user', { id: ownerFields.userId }, 'read');
  }
  if (
    ownerFields.ownerModel === 'OrganizationUser' &&
    ownerFields.organizationId &&
    ownerFields.userId
  ) {
    return holdsOnRecord(
      permix,
      'organizationUser',
      { organizationId: ownerFields.organizationId, userId: ownerFields.userId },
      'own',
    );
  }
  if (
    ownerFields.ownerModel === 'SpaceUser' &&
    ownerFields.organizationId &&
    ownerFields.spaceId &&
    ownerFields.userId
  ) {
    return holdsOnRecord(
      permix,
      'spaceUser',
      {
        organizationId: ownerFields.organizationId,
        spaceId: ownerFields.spaceId,
        userId: ownerFields.userId,
      },
      'own',
    );
  }
  return false;
};

const PLACEMENT_READ_ACTIONS = ['read', 'manage'] as const;

export const ownerArtifactPlacementsWhere = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
): Promise<Prisma.ArtifactPlacementWhereInput> => {
  const permix = c.get('permix');
  const ownerFields = ownerColumns(owner);

  // Entitlement-only tokens without any db:ArtifactPlacement read/manage entitlement cannot read placements.
  const token = c.get('token');
  const {
    entitlements: placementEntitlements,
    directIds: directPlacementIds,
    hasBroadEntitlement: hasBroadPlacementEntitlement,
  } = directEntitledIds(permix, 'db:ArtifactPlacement', PLACEMENT_READ_ACTIONS);

  if (
    !permix.isSuperadmin() &&
    token &&
    !token.full &&
    token.role === null &&
    placementEntitlements.length === 0
  ) {
    return { id: { in: [] } };
  }

  const [anyArtifactWhere, canOwnerReadPrivate, canReadTenant, canReadPublic] = await Promise.all([
    accessibleAnyArtifactWhere(c),
    canAccessOwnerPrivatePlacements(permix, ownerFields),
    permix.isSuperadmin()
      ? Promise.resolve(true)
      : holdsOnRecord(
          permix,
          'artifact',
          { id: '', kind: ArtifactKind.folder, effectiveAccess: 'tenant', ...ownerFields },
          'read',
        ),
    permix.isSuperadmin()
      ? Promise.resolve(true)
      : holdsOnRecord(
          permix,
          'artifact',
          { id: '', kind: ArtifactKind.folder, effectiveAccess: 'public', ...ownerFields },
          'read',
        ),
  ]);

  const artifactWhere: Prisma.ArtifactWhereInput = anyArtifactWhere
    ? { AND: [{ deletedAt: null }, anyArtifactWhere] }
    : { deletedAt: null };

  const rootContainerWhere: Prisma.ArtifactWhereInput = {
    deletedAt: null,
    kind: ArtifactKind.root,
    ...ownerFields,
  };

  const buildRootWhere = (): Prisma.ArtifactPlacementWhereInput | null => {
    if (canOwnerReadPrivate || hasBroadPlacementEntitlement) {
      return { containerArtifact: rootContainerWhere };
    }
    const allowedAccess: ArtifactAccess[] = [];
    if (canReadPublic) allowedAccess.push('public');
    if (canReadTenant) allowedAccess.push('tenant');
    const rootOr: Prisma.ArtifactPlacementWhereInput[] = [];
    if (allowedAccess.length > 0) rootOr.push({ access: { in: allowedAccess } });
    if (directPlacementIds.length > 0) rootOr.push({ id: { in: directPlacementIds } });
    if (rootOr.length === 0) return null;
    return { containerArtifact: rootContainerWhere, OR: rootOr };
  };

  if (!hasContainerFilter(c)) {
    const rootWhere = buildRootWhere();
    if (!rootWhere) return { id: { in: [] } };
    return {
      deletedAt: null,
      artifact: artifactWhere,
      ...rootWhere,
    };
  }

  const ownerContainerWhere = await accessibleArtifactWhereForOwner(c, owner);
  const nonRootContainerWhere: Prisma.ArtifactWhereInput = ownerContainerWhere
    ? {
        AND: [
          { deletedAt: null, kind: { not: ArtifactKind.root }, ...ownerFields },
          ownerContainerWhere,
        ],
      }
    : { deletedAt: null, kind: { not: ArtifactKind.root }, ...ownerFields };

  const buildNonRootWhere = (): Prisma.ArtifactPlacementWhereInput => {
    if (canOwnerReadPrivate || hasBroadPlacementEntitlement) {
      return { containerArtifact: nonRootContainerWhere };
    }
    const nonRootOr: Prisma.ArtifactPlacementWhereInput[] = [
      { access: { in: ['inherit', 'public'] } },
    ];
    if (canReadTenant) nonRootOr.push({ access: 'tenant' });
    const manageGrant = effectiveGrantWhere(permix, ['admin', 'owner']);
    if (manageGrant) nonRootOr.push({ containerArtifact: manageGrant });
    if (directPlacementIds.length > 0) nonRootOr.push({ id: { in: directPlacementIds } });
    return { containerArtifact: nonRootContainerWhere, OR: nonRootOr };
  };

  const branches: Prisma.ArtifactPlacementWhereInput[] = [buildNonRootWhere()];
  const rootWhere = buildRootWhere();
  if (rootWhere) branches.push(rootWhere);

  return {
    deletedAt: null,
    artifact: artifactWhere,
    OR: branches,
  };
};

export const filterAccessibleArtifactPlacements = async (
  c: Context<AppEnv>,
  rows: PlacementWithArtifacts[],
): Promise<PlacementWithArtifacts[]> => {
  const permix = c.get('permix');
  const checked = await Promise.all(
    rows.map((row) => holdsOnRecord(permix, 'artifactPlacement', row, 'read')),
  );
  return rows.filter((_, index) => checked[index]);
};

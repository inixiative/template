/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { type ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import { directEntitledIds, ownerPrivateRead } from '@template/permissions';
import type { Context } from 'hono';
import { isPlainObject } from 'lodash-es';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import type { BracketQueryRecord } from '#/lib/utils/parseBracketNotation';
import {
  accessibleAnyArtifactWhere,
  effectiveGrantWhere,
  probeOwnerArtifactAccess,
} from '#/modules/artifact/queries/accessibleArtifactWhere';
import {
  defaultOrderBy,
  ownerArtifactsWhere,
} from '#/modules/artifact/queries/ownerArtifactsQuery';
import {
  contextArtifactOwner,
  type OwnerRef,
  ownerColumns,
} from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

const PLACEMENT_READ_ACTIONS = ['read', 'manage'] as const;
const ownerPrivateReadRule = ownerPrivateRead();

const hasContainerFilter = (c: Context<AppEnv>): boolean => {
  const bracketSearchFields = c.get('bracketQuery').searchFields;
  const searchFields = isPlainObject(bracketSearchFields)
    ? (bracketSearchFields as BracketQueryRecord)
    : validatedQuery(c as ValidatedContext<'query', { searchFields?: BracketQueryRecord }>)
        .searchFields;
  return Boolean(
    searchFields && ('containerArtifactId' in searchFields || 'containerArtifact' in searchFields),
  );
};

const ownerArtifactPlacementsWhere = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
): Promise<Prisma.ArtifactPlacementWhereInput> => {
  const permix = c.get('permix');
  const ownerFields = ownerColumns(owner);
  const rootContainerWhere: Prisma.ArtifactWhereInput = { kind: ArtifactKind.root, ...ownerFields };

  if (permix.isSuperadmin()) {
    return {
      containerArtifact: hasContainerFilter(c) ? ownerFields : rootContainerWhere,
    };
  }

  // Entitlement-only tokens without any db:ArtifactPlacement read/manage entitlement cannot read placements.
  const token = c.get('token');
  const {
    entitlements: placementEntitlements,
    directIds: directPlacementIds,
    hasBroadEntitlement: hasBroadPlacementEntitlement,
  } = directEntitledIds(permix, 'db:ArtifactPlacement', PLACEMENT_READ_ACTIONS);

  if (token && !token.full && token.role === null && placementEntitlements.length === 0) {
    return { id: { in: [] } };
  }

  const [anyArtifactWhere, canOwnerReadPrivate, probed] = await Promise.all([
    accessibleAnyArtifactWhere(c),
    holdsOnRecord(
      permix,
      'artifact',
      { id: '', kind: ArtifactKind.root, effectiveAccess: 'private', ...ownerFields },
      ownerPrivateReadRule,
    ),
    probeOwnerArtifactAccess(permix, ownerFields),
  ]);

  const containerPlacementWhere = (
    containerWhere: Prisma.ArtifactWhereInput,
    isRoot: boolean,
  ): Prisma.ArtifactPlacementWhereInput | null => {
    if (canOwnerReadPrivate || hasBroadPlacementEntitlement) {
      return { containerArtifact: containerWhere };
    }
    const allowedAccess: ArtifactAccess[] = isRoot ? [] : ['inherit', 'public'];
    if (isRoot && probed.canReadPublic) allowedAccess.push('public');
    if (probed.canReadTenant) allowedAccess.push('tenant');

    const orClauses: Prisma.ArtifactPlacementWhereInput[] = [];
    if (allowedAccess.length > 0) orClauses.push({ access: { in: allowedAccess } });
    if (!isRoot) {
      const manageGrant = effectiveGrantWhere(permix, ['admin', 'owner']);
      if (manageGrant) orClauses.push({ containerArtifact: manageGrant });
    }
    if (directPlacementIds.length > 0) orClauses.push({ id: { in: directPlacementIds } });
    return orClauses.length > 0 ? { containerArtifact: containerWhere, OR: orClauses } : null;
  };

  const artifactFilter = anyArtifactWhere ? { artifact: anyArtifactWhere } : {};
  const rootWhere = containerPlacementWhere(rootContainerWhere, true);
  if (!hasContainerFilter(c)) {
    return rootWhere ? { ...artifactFilter, ...rootWhere } : { id: { in: [] } };
  }

  const nonRootWhere = containerPlacementWhere(await ownerArtifactsWhere(c, owner, probed), false)!;
  return { ...artifactFilter, OR: rootWhere ? [nonRootWhere, rootWhere] : [nonRootWhere] };
};

export const ownerArtifactPlacementsQuery = async (
  c: ValidatedContext<'query', { orderBy?: string[] }>,
) => ({
  where: await ownerArtifactPlacementsWhere(c, contextArtifactOwner(c)),
  include: { artifact: true, containerArtifact: true },
  orderBy: defaultOrderBy(c, { createdAt: 'desc' as const }),
});

export const filterAccessibleArtifactPlacements = async <
  T extends ArtifactPlacement & { artifact: Artifact; containerArtifact: Artifact },
>(
  c: Context<AppEnv>,
  rows: T[],
): Promise<T[]> => {
  const permix = c.get('permix');
  const checked = await Promise.all(
    rows.map((row) => holdsOnRecord(permix, 'artifactPlacement', row, 'read')),
  );
  return rows.filter((_, index) => checked[index]);
};

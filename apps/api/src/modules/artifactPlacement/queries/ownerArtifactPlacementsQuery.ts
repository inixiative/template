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
import { paginate } from '#/lib/prisma/paginate';
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

type PlacementWithArtifacts = ArtifactPlacement & {
  artifact: Artifact;
  containerArtifact: Artifact;
};

const includeArtifactPlacementList = {
  artifact: true,
  containerArtifact: true,
} satisfies Prisma.ArtifactPlacementInclude;

const PLACEMENT_READ_ACTIONS = ['read', 'manage'] as const;
const ownerPrivateReadRule = ownerPrivateRead();

const hasContainerFilter = (c: Context<AppEnv>): boolean => {
  const query = validatedQuery(
    c as ValidatedContext<'query', { searchFields?: BracketQueryRecord }>,
  );
  const bracketSearchFields = c.get('bracketQuery').searchFields;
  const searchFields = isPlainObject(bracketSearchFields)
    ? (bracketSearchFields as BracketQueryRecord)
    : query.searchFields;
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
  const rootContainerWhere: Prisma.ArtifactWhereInput = {
    deletedAt: null,
    kind: ArtifactKind.root,
    ...ownerFields,
  };

  if (permix.isSuperadmin()) {
    return {
      deletedAt: null,
      artifact: { deletedAt: null },
      containerArtifact: hasContainerFilter(c)
        ? { deletedAt: null, ...ownerFields }
        : rootContainerWhere,
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

  const artifactWhere: Prisma.ArtifactWhereInput = anyArtifactWhere
    ? { AND: [{ deletedAt: null }, anyArtifactWhere] }
    : { deletedAt: null };

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

  const rootWhere = containerPlacementWhere(rootContainerWhere, true);
  if (!hasContainerFilter(c)) {
    return rootWhere
      ? { deletedAt: null, artifact: artifactWhere, ...rootWhere }
      : { id: { in: [] } };
  }

  const nonRootWhere = containerPlacementWhere(await ownerArtifactsWhere(c, owner, probed), false)!;
  const branches = rootWhere ? [nonRootWhere, rootWhere] : [nonRootWhere];
  return { deletedAt: null, artifact: artifactWhere, OR: branches };
};

const filterAccessibleArtifactPlacements = async (
  c: Context<AppEnv>,
  rows: PlacementWithArtifacts[],
): Promise<PlacementWithArtifacts[]> => {
  const permix = c.get('permix');
  const checked = await Promise.all(
    rows.map((row) => holdsOnRecord(permix, 'artifactPlacement', row, 'read')),
  );
  return rows.filter((_, index) => checked[index]);
};

export const paginateOwnerArtifactPlacements = async (
  c: ValidatedContext<'query', { orderBy?: string[] }>,
) => {
  const db = c.get('db');
  const owner = contextArtifactOwner(c);
  const { data, pagination } = await paginate(c, db.artifactPlacement, {
    where: await ownerArtifactPlacementsWhere(c, owner),
    include: includeArtifactPlacementList,
    orderBy: defaultOrderBy(c, { createdAt: 'desc' as const }),
  });
  return { data: await filterAccessibleArtifactPlacements(c, data), pagination };
};

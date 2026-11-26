/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { hydrateMany, type Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { ArtifactKind, type PlacementReadAccess } from '@template/db/generated/client/enums';
import { check } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { isPlainObject } from 'lodash-es';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
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

  const token = c.get('token');
  if (token && !token.full && token.role === null) return { id: { in: [] } };

  const [anyArtifactWhere, probed] = await Promise.all([
    accessibleAnyArtifactWhere(c),
    probeOwnerArtifactAccess(permix, ownerFields),
  ]);

  const containerPlacementWhere = (
    containerWhere: Prisma.ArtifactWhereInput,
    isRoot: boolean,
  ): Prisma.ArtifactPlacementWhereInput | null => {
    if (probed.canOwnerReadPrivate) {
      return { containerArtifact: containerWhere };
    }
    const allowedReadAccess: PlacementReadAccess[] = isRoot ? [] : ['inherit', 'public'];
    if (isRoot && probed.canReadPublic) allowedReadAccess.push('public');
    if (probed.canReadTenant) allowedReadAccess.push('tenant');

    const orClauses: Prisma.ArtifactPlacementWhereInput[] = [];
    if (allowedReadAccess.length > 0) orClauses.push({ readAccess: { in: allowedReadAccess } });
    if (probed.canOperateTenant) {
      orClauses.push({ operateAccess: 'tenant' });
      if (!isRoot) {
        orClauses.push({
          operateAccess: 'inherit',
          containerArtifact: { effectiveOperateAccess: 'tenant' },
        });
      }
    }
    if (!isRoot) {
      const manageGrant = effectiveGrantWhere(permix, ['admin', 'owner']);
      if (manageGrant) orClauses.push({ containerArtifact: manageGrant });
    }
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
  const hydratedRows = await hydrateMany('artifactPlacement', rows);
  return rows.filter((_, index) =>
    check(permix, 'artifactPlacement', hydratedRows[index]!, 'read'),
  );
};

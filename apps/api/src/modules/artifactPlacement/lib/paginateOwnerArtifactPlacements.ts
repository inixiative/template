/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Prisma } from '@template/db';
import { db, hydrate } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { check } from '@template/permissions/rebac';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { paginate } from '#/lib/prisma/paginate';
import type { BracketQueryRecord } from '#/lib/utils/parseBracketNotation';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/lib/artifactOwner';
import {
  readableAnyArtifactWhere,
  readableArtifactWhereForOwner,
} from '#/modules/artifact/lib/readableArtifactWhere';

type PlacementWithArtifacts = ArtifactPlacement & {
  artifact: Artifact;
  containerArtifact: Artifact | null;
};

export const paginateOwnerArtifactPlacements = async (
  c: ValidatedContext<
    'query',
    {
      page?: number;
      pageSize?: number;
      search?: string;
      searchFields?: BracketQueryRecord;
      orderBy?: string[];
    }
  >,
  owner: OwnerRef,
) => {
  const permix = c.get('permix');
  const ownerFields = ownerColumns(owner);

  if (owner.ownerModel === 'OrganizationUser' || owner.ownerModel === 'SpaceUser') {
    const canViewSeat = await holdsOnRecord(
      permix,
      'artifact',
      { id: '', access: 'private', ...ownerFields },
      'read',
    );
    if (!canViewSeat) throw makeError({ status: 403, message: 'Forbidden' });
  }

  // Entitlement-only tokens without any db:ArtifactPlacement.read entitlement cannot read placements.
  const token = c.get('token');
  if (
    !permix.isSuperadmin() &&
    token &&
    !token.full &&
    token.role === null &&
    permix.entitlements('db:ArtifactPlacement', 'read').length === 0
  ) {
    const { page = 1, pageSize = 20 } = validatedQuery(c);
    return {
      data: [] as PlacementWithArtifacts[],
      pagination: { page, pageSize, total: 0, totalPages: 0 },
    };
  }

  const [anyArtifactWhere, ownerContainerWhere] = await Promise.all([
    readableAnyArtifactWhere(c),
    readableArtifactWhereForOwner(c, owner),
  ]);

  const artifactWhere: Prisma.ArtifactWhereInput = anyArtifactWhere
    ? { AND: [{ deletedAt: null }, anyArtifactWhere] }
    : { deletedAt: null };
  const containerWhere: Prisma.ArtifactWhereInput = ownerContainerWhere
    ? { AND: [{ deletedAt: null }, ownerContainerWhere] }
    : { deletedAt: null };

  const where: Prisma.ArtifactPlacementWhereInput = {
    AND: [
      { deletedAt: null, ...ownerFields },
      { artifact: artifactWhere },
      { OR: [{ containerArtifactId: null }, { containerArtifact: containerWhere }] },
    ],
  };

  const hasOrderBy = Boolean(validatedQuery(c).orderBy?.length);
  const result = await paginate(c, db.artifactPlacement, {
    where,
    include: { artifact: true, containerArtifact: true },
    ...(hasOrderBy ? {} : { orderBy: { createdAt: 'desc' } }),
  });

  const rows = result.data as PlacementWithArtifacts[];
  const checked = await Promise.all(
    rows.map(async (row) => {
      const hydrated = await hydrate('artifactPlacement', row);
      return check(permix, 'artifactPlacement', hydrated, 'read');
    }),
  );

  return {
    data: rows.filter((_, index) => checked[index]),
    pagination: result.pagination,
  };
};

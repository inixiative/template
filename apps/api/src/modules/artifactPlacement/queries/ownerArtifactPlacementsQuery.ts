/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Prisma } from '@template/db';
import { hydrate } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { check } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import {
  readableAnyArtifactWhere,
  readableArtifactWhereForOwner,
} from '#/modules/artifact/queries/readableArtifactWhere';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

export type PlacementWithArtifacts = ArtifactPlacement & {
  artifact: Artifact;
  containerArtifact: Artifact | null;
};

export const includeArtifactPlacementList = {
  artifact: true,
  containerArtifact: true,
} satisfies Prisma.ArtifactPlacementInclude;

export const defaultArtifactPlacementOrderBy = (
  c: ValidatedContext<'query', { orderBy?: string[] }>,
): Prisma.ArtifactPlacementOrderByWithRelationInput | undefined =>
  validatedQuery(c).orderBy?.length ? undefined : { createdAt: 'desc' };

export const ownerArtifactPlacementsWhere = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
): Promise<Prisma.ArtifactPlacementWhereInput> => {
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
    return { id: { in: [] } };
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

  return {
    AND: [
      { deletedAt: null, ...ownerFields },
      { artifact: artifactWhere },
      { OR: [{ containerArtifactId: null }, { containerArtifact: containerWhere }] },
    ],
  };
};

export const filterReadableArtifactPlacements = async (
  c: Context<AppEnv>,
  rows: PlacementWithArtifacts[],
): Promise<PlacementWithArtifacts[]> => {
  const permix = c.get('permix');
  const checked = await Promise.all(
    rows.map(async (row) => {
      const hydrated = await hydrate('artifactPlacement', row);
      return check(permix, 'artifactPlacement', hydrated, 'read');
    }),
  );
  return rows.filter((_, index) => checked[index]);
};

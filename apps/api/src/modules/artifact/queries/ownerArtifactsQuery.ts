/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Prisma } from '@template/db';
import type { Artifact, ArtifactPermission } from '@template/db/generated/client/client';
import { ArtifactKind } from '@template/db/generated/client/enums';
import { check } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { readableArtifactWhereForOwner } from '#/modules/artifact/queries/readableArtifactWhere';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/services/artifactOwner';
import { hydrateArtifact } from '#/modules/artifact/services/checkArtifactPermission';
import type { AppEnv } from '#/types/appEnv';

export type ArtifactWithPermissions = Artifact & { permissions: ArtifactPermission[] };

export const includeArtifactList = {
  permissions: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ArtifactInclude;

export const defaultArtifactOrderBy = (
  c: ValidatedContext<'query', { orderBy?: string[] }>,
): Prisma.ArtifactOrderByWithRelationInput | undefined =>
  validatedQuery(c).orderBy?.length ? undefined : { name: 'asc' };

export const ownerArtifactsWhere = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
): Promise<Prisma.ArtifactWhereInput> => {
  const ownerWhere: Prisma.ArtifactWhereInput = {
    deletedAt: null,
    kind: { not: ArtifactKind.root },
    ...ownerColumns(owner),
  };
  const visibilityWhere = await readableArtifactWhereForOwner(c, owner);
  return visibilityWhere ? { AND: [ownerWhere, visibilityWhere] } : ownerWhere;
};

export const shapeReadableArtifacts = async (
  c: Context<AppEnv>,
  rows: ArtifactWithPermissions[],
): Promise<ArtifactWithPermissions[]> => {
  if (!c.get('user') && !c.get('token')) {
    return rows.map((row) => ({ ...row, permissions: [] }));
  }
  const permix = c.get('permix');
  const hydratedRows = await Promise.all(rows.map((row) => hydrateArtifact(row)));
  return rows.flatMap((row, index) => {
    const hydrated = hydratedRows[index]!;
    if (!check(permix, 'artifact', hydrated, 'read')) return [];
    const canManage = check(permix, 'artifact', hydrated, 'manage');
    return [{ ...row, permissions: canManage ? row.permissions : [] }];
  });
};

/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { hydrate, type Prisma } from '@template/db';
import type { Artifact, ArtifactPermission } from '@template/db/generated/client/client';
import { ArtifactKind } from '@template/db/generated/client/enums';
import { check } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { paginate } from '#/lib/prisma/paginate';
import {
  accessibleArtifactWhereForOwner,
  type OwnerArtifactAccessProbe,
} from '#/modules/artifact/queries/accessibleArtifactWhere';
import {
  contextArtifactOwner,
  type OwnerRef,
  ownerColumns,
} from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

export type ArtifactWithPermissions = Artifact & { artifactPermissions: ArtifactPermission[] };

const includeArtifactList = {
  artifactPermissions: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ArtifactInclude;

export const defaultOrderBy = <T>(
  c: ValidatedContext<'query', { orderBy?: string[] }>,
  fallback: T,
): T | undefined => (validatedQuery(c).orderBy?.length ? undefined : fallback);

export const ownerArtifactsWhere = async (
  c: Context<AppEnv>,
  owner: OwnerRef,
  probed?: OwnerArtifactAccessProbe,
): Promise<Prisma.ArtifactWhereInput> => {
  const ownerWhere: Prisma.ArtifactWhereInput = {
    deletedAt: null,
    kind: { not: ArtifactKind.root },
    ...ownerColumns(owner),
  };
  const accessWhere = await accessibleArtifactWhereForOwner(c, owner, probed);
  return accessWhere ? { AND: [ownerWhere, accessWhere] } : ownerWhere;
};

const shapeAccessibleArtifacts = async (
  c: Context<AppEnv>,
  rows: ArtifactWithPermissions[],
): Promise<ArtifactWithPermissions[]> => {
  if (!c.get('user') && !c.get('token')) {
    return rows.map((row) => ({ ...row, artifactPermissions: [] }));
  }
  const permix = c.get('permix');
  const hydratedRows = await Promise.all(rows.map((row) => hydrate('artifact', row)));
  return rows.flatMap((row, index) => {
    const hydrated = hydratedRows[index]!;
    if (!check(permix, 'artifact', hydrated, 'read')) return [];
    const canManage = check(permix, 'artifact', hydrated, 'manage');
    return [{ ...row, artifactPermissions: canManage ? row.artifactPermissions : [] }];
  });
};

export const paginateOwnerArtifacts = async (
  c: ValidatedContext<'query', { orderBy?: string[] }>,
) => {
  const db = c.get('db');
  const owner = contextArtifactOwner(c);
  const { data, pagination } = await paginate(c, db.artifact, {
    where: await ownerArtifactsWhere(c, owner),
    include: includeArtifactList,
    orderBy: defaultOrderBy(c, { name: 'asc' as const }),
  });
  return { data: await shapeAccessibleArtifacts(c, data), pagination };
};

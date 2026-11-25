/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact, ArtifactPermission } from '@template/db/generated/client/client';
import { check } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { paginate } from '#/lib/prisma/paginate';
import type { BracketQueryRecord } from '#/lib/utils/parseBracketNotation';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/lib/artifactOwner';
import { hydrateArtifact } from '#/modules/artifact/lib/checkArtifactPermission';
import { readableArtifactWhereForOwner } from '#/modules/artifact/lib/readableArtifactWhere';
import type { AppEnv } from '#/types/appEnv';

type ArtifactWithPermissions = Artifact & { permissions: ArtifactPermission[] };

const isBracketRecord = (value: unknown): value is BracketQueryRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasClientFilter = (c: Context<AppEnv>): boolean => {
  const query = validatedQuery(
    c as ValidatedContext<'query', { search?: string; searchFields?: BracketQueryRecord }>,
  );
  const bracketSearchFields = c.get('bracketQuery').searchFields;
  const searchFields = isBracketRecord(bracketSearchFields)
    ? bracketSearchFields
    : query.searchFields;
  return (
    Boolean(query.search?.trim()) ||
    (Boolean(searchFields) && Object.keys(searchFields!).length > 0)
  );
};

export const paginateOwnerArtifacts = async (
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
  const query = validatedQuery(c);
  const hasOrderBy = Boolean(query.orderBy?.length);
  const rootWhere = hasClientFilter(c)
    ? {}
    : {
        placements: {
          none: { containerArtifactId: { not: null }, containerArtifact: ownerColumns(owner) },
        },
      };
  const ownerWhere = { deletedAt: null, ...ownerColumns(owner), ...rootWhere };
  const visibilityWhere = await readableArtifactWhereForOwner(c, owner);
  const where = visibilityWhere ? { AND: [ownerWhere, visibilityWhere] } : ownerWhere;
  const include = { permissions: { orderBy: { createdAt: 'asc' as const } } };

  const result = await paginate(c, db.artifact, {
    where,
    include,
    ...(hasOrderBy ? {} : { orderBy: { name: 'asc' } }),
  });

  const rows = result.data as ArtifactWithPermissions[];
  if (!c.get('user') && !c.get('token')) {
    return {
      data: rows.map((row) => ({ ...row, permissions: [] })),
      pagination: result.pagination,
    };
  }

  const hydratedRows = await Promise.all(rows.map((row) => hydrateArtifact(row)));
  const data = rows.flatMap((row, index) => {
    const hydrated = hydratedRows[index]!;
    if (!check(permix, 'artifact', hydrated, 'read')) return [];
    const canManage = check(permix, 'artifact', hydrated, 'manage');
    return [{ ...row, permissions: canManage ? row.permissions : [] }];
  });

  return { data, pagination: result.pagination };
};

/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { andWhere } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { Artifact, ArtifactPermission } from '@template/db/generated/client/client';
import { check } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { applyFilterLensWheresToPrismaWhere } from '#/lib/prisma/applyFilterLensWheresToPrismaWhere';
import { buildOrderBy } from '#/lib/prisma/buildOrderBy';
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';
import { paginate } from '#/lib/prisma/paginate';
import type { BracketQueryRecord } from '#/lib/utils/parseBracketNotation';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/lib/artifactOwner';
import { hydrateArtifact } from '#/modules/artifact/lib/checkArtifactPermission';
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
  options: { allReadable: boolean },
) => {
  const permix = c.get('permix');
  const query = validatedQuery(c);
  const hasOrderBy = Boolean(query.orderBy?.length);
  const rootWhere = hasClientFilter(c)
    ? {}
    : { placements: { none: { containerArtifact: ownerColumns(owner) } } };
  const ownerWhere = { deletedAt: null, ...ownerColumns(owner), ...rootWhere };
  const include = { permissions: { orderBy: { createdAt: 'asc' as const } } };

  const stripPermissionsIfNotManager = async (rows: ArtifactWithPermissions[]) =>
    Promise.all(
      rows.map(async (row) => {
        const hydrated = await hydrateArtifact(row);
        const canManage = check(permix, 'artifact', hydrated, 'manage');
        return { ...row, permissions: canManage ? row.permissions : [] };
      }),
    );

  if (options.allReadable) {
    const result = await paginate(c, db.artifact, {
      where: ownerWhere,
      include,
      ...(hasOrderBy ? {} : { orderBy: { name: 'asc' } }),
    });
    return {
      data: await stripPermissionsIfNotManager(result.data),
      pagination: result.pagination,
    };
  }

  // why: until AUTH-013 compiles ReBAC into SQL, non-managers listing an org/space filter per-row in memory.
  const { page = 1, pageSize = 20, search, orderBy: rawOrderBy } = query;
  const bracketSearchFields = c.get('bracketQuery').searchFields;
  const searchFields = isBracketRecord(bracketSearchFields)
    ? bracketSearchFields
    : query.searchFields;
  const filterLens = c.get('filterLens')!;
  const searchWhere = buildWhereClause({
    filterLens,
    search,
    searchFields,
    skipFieldValidation: isSuperadmin(c),
  });
  const where = await applyFilterLensWheresToPrismaWhere(
    filterLens,
    andWhere([ownerWhere as Record<string, unknown>, searchWhere as Record<string, unknown>]),
  );
  const orderBy = buildOrderBy({
    callerOrderBy: hasOrderBy ? undefined : { name: 'asc' },
    clientOrderBy: rawOrderBy,
  });
  const candidates = await db.artifact.findMany({ where, include, orderBy });

  const checks = await Promise.all(
    candidates.map(async (row) => {
      const hydrated = await hydrateArtifact(row);
      return {
        canRead: check(permix, 'artifact', hydrated, 'read'),
        canManage: check(permix, 'artifact', hydrated, 'manage'),
      };
    }),
  );
  const readable = candidates.flatMap((row, index) => {
    const access = checks[index]!;
    if (!access.canRead) return [];
    return [{ ...row, permissions: access.canManage ? row.permissions : [] }];
  });
  const total = readable.length;
  const skip = (page - 1) * pageSize;

  return {
    data: readable.slice(skip, skip + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

import { type AnyDelegate, type Args, Prisma, type Result } from '@template/db';
import type { Context } from 'hono';
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';
import { parseOrderBy } from '#/lib/routeTemplates/orderBySchema';
import type { AppEnv } from '#/types/appEnv';

type PaginationParams = {
  page?: number;
  pageSize?: number;
  orderBy?: Record<string, Prisma.SortOrder>[];
};

type PaginationResult = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type PaginatedResult<T> = {
  data: T[];
  pagination: PaginationResult;
};

export const paginate = async <
  T extends AnyDelegate,
  R = Result<T, Args<T, 'findMany'> & object, 'findMany'>[number],
>(
  c: Context<AppEnv>,
  delegate: T,
  options?: {
    searchableFields?: string[];
    where?: Record<string, any>;
    include?: Record<string, unknown>;
    omit?: Record<string, unknown>;
  },
): Promise<PaginatedResult<R>> => {
  const query = (c.req as unknown as { valid: (key: string) => unknown }).valid('query') as Record<string, any>;
  const { page = 1, pageSize = 20, search, orderBy: rawOrderBy } = query;

  const bracketQuery = (c.get('bracketQuery') ?? {}) as Record<string, any>;
  const searchFields = bracketQuery.searchFields ?? query.searchFields;

  const contextSearchableFields = c.get('searchableFields');
  const searchableFields = contextSearchableFields ?? options?.searchableFields;

  const searchWhere = searchableFields?.length
    ? buildWhereClause({ search, searchFields, searchableFields, filters: {} })
    : {};

  const where = { ...options?.where, ...searchWhere };

  const parsedOrderBy = rawOrderBy ? parseOrderBy(rawOrderBy) : [];
  if (!parsedOrderBy.some((o) => 'id' in o)) parsedOrderBy.push({ id: Prisma.SortOrder.desc });

  const [data, total] = await Promise.all([
    delegate.findMany({
      where,
      orderBy: parsedOrderBy,
      include: options?.include,
      omit: options?.omit,
      take: pageSize,
      skip: (page - 1) * pageSize,
    } as unknown as Args<T, 'findMany'>),
    delegate.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

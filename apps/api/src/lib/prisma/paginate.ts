import type { Context } from 'hono';
import { Prisma, type AnyDelegate, type Args, type Result } from '@template/db';
import type { AppEnv } from '#/types/appEnv';
import { buildWhereClause } from './buildWhereClause';
import { parseOrderBy } from '#/lib/routeTemplates/orderBySchema';

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

export const paginate = async <T extends AnyDelegate, A extends Args<T, 'findMany'> & object>(
  c: Context<AppEnv>,
  delegate: T,
  options?: {
    searchableFields?: string[];
    where?: Record<string, any>;
    include?: A extends { include: infer I } ? I : never;
    omit?: A extends { omit: infer O } ? O : never;
  },
): Promise<PaginatedResult<Result<T, A, 'findMany'>[number]>> => {
  const query = c.req.valid('query');
  const { page = 1, pageSize = 20, search, orderBy: rawOrderBy } = query;

  const bracketQuery = c.get('bracketQuery') ?? {};
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
    } as A),
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

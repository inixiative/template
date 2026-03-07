import { type AnyDelegate, type Args, Prisma, type Result } from '@template/db';
import { getValidatedQuery, type ValidatedContext } from '#/lib/context/getValidatedData';
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';
import { parseOrderBy } from '#/lib/routeTemplates/orderBySchema';

type PaginationParams = {
  page?: number;
  pageSize?: number;
  orderBy?: Record<string, Prisma.SortOrder>[];
};

type PaginationQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  searchFields?: Record<string, any>;
  orderBy?: string[];
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
  TItem = Result<T, Args<T, 'findMany'> & object, 'findMany'>[number],
  C extends ValidatedContext<'query', PaginationQuery> = ValidatedContext<'query', PaginationQuery>,
>(
  c: C,
  delegate: T,
  options?: {
    searchableFields?: readonly string[];
    where?: Record<string, any>;
    orderBy?: Record<string, Prisma.SortOrder> | Record<string, Prisma.SortOrder>[];
    include?: Record<string, unknown>;
    omit?: Record<string, unknown>;
  },
): Promise<PaginatedResult<TItem>> => {
  const query = getValidatedQuery(c);
  const { page = 1, pageSize = 20, search, orderBy: rawOrderBy } = query;

  const bracketQuery = (c.get('bracketQuery') ?? {}) as Record<string, any>;
  const searchFields = bracketQuery.searchFields ?? query.searchFields;

  const contextSearchableFields = c.get('searchableFields');
  const searchableFields = contextSearchableFields ?? options?.searchableFields;

  const searchWhere = searchableFields?.length
    ? buildWhereClause({ search, searchFields, searchableFields, filters: {} })
    : {};

  const where = { ...options?.where, ...searchWhere };

  const parsedOrderBy = rawOrderBy
    ? parseOrderBy(rawOrderBy)
    : options?.orderBy
      ? Array.isArray(options.orderBy)
        ? options.orderBy
        : [options.orderBy]
      : [];
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

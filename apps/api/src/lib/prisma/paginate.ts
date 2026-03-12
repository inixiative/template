import { type AnyDelegate, type Args, Prisma, type Result } from '@template/db';
import { getValidatedQuery, type ValidatedContext } from '#/lib/context/getValidatedData';
import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';
import { parseOrderBy } from '#/lib/routeTemplates/orderBySchema';
import type { BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

type PaginationQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  searchFields?: BracketQueryRecord;
  orderBy?: string[];
};

type FindManyArgs<T extends AnyDelegate> = Args<T, 'findMany'> & object;
type FindManyWhere<T extends AnyDelegate> = FindManyArgs<T> extends { where?: infer W } ? W : never;
type FindManyOrderBy<T extends AnyDelegate> = FindManyArgs<T> extends { orderBy?: infer O } ? O : never;
type FindManyInclude<T extends AnyDelegate> = FindManyArgs<T> extends { include?: infer I } ? I : never;
type FindManyOmit<T extends AnyDelegate> = FindManyArgs<T> extends { omit?: infer O } ? O : never;
type FindManySelect<T extends AnyDelegate> = FindManyArgs<T> extends { select?: infer S } ? S : never;
type FindManyCursor<T extends AnyDelegate> = FindManyArgs<T> extends { cursor?: infer C } ? C : never;
type FindManyDistinct<T extends AnyDelegate> = FindManyArgs<T> extends { distinct?: infer D } ? D : never;
type PaginateOptions<T extends AnyDelegate> = {
  searchableFields?: readonly string[];
  where?: FindManyWhere<T>;
  orderBy?: FindManyOrderBy<T>;
  include?: FindManyInclude<T>;
  omit?: FindManyOmit<T>;
  select?: FindManySelect<T>;
  cursor?: FindManyCursor<T>;
  distinct?: FindManyDistinct<T>;
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

const isBracketQueryRecord = (value: BracketQueryValue | undefined): value is BracketQueryRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const paginate = async <
  T extends AnyDelegate,
  TItem = Result<T, FindManyArgs<T>, 'findMany'>[number],
  C extends ValidatedContext<'query', PaginationQuery> = ValidatedContext<'query', PaginationQuery>,
>(
  c: C,
  delegate: T,
  options?: PaginateOptions<T>,
): Promise<PaginatedResult<TItem>> => {
  const query = getValidatedQuery(c);
  const { page = 1, pageSize = 20, search, orderBy: rawOrderBy } = query;
  const { searchableFields: explicitSearchableFields, ...findManyOptions } = (options ?? {}) as PaginateOptions<T>;

  const bracketQuery = c.get('bracketQuery');
  const searchFields = isBracketQueryRecord(bracketQuery.searchFields) ? bracketQuery.searchFields : query.searchFields;

  const contextSearchableFields = c.get('searchableFields');
  const searchableFields = contextSearchableFields ?? explicitSearchableFields;

  const skipFieldValidation = isSuperadmin(c);

  const searchWhere = searchableFields?.length || skipFieldValidation
    ? buildWhereClause({ search, searchFields, searchableFields, skipFieldValidation })
    : {};

  const baseWhere = (findManyOptions.where ?? {}) as Record<string, unknown>;
  const where = { ...baseWhere, ...searchWhere } as FindManyWhere<T>;

  const parsedOrderBy: Record<string, Prisma.SortOrder>[] = rawOrderBy
    ? parseOrderBy(rawOrderBy)
    : findManyOptions.orderBy
      ? Array.isArray(findManyOptions.orderBy)
        ? ([...findManyOptions.orderBy] as Record<string, Prisma.SortOrder>[])
        : [findManyOptions.orderBy as Record<string, Prisma.SortOrder>]
      : [];
  if (!parsedOrderBy.some((o) => 'id' in o)) parsedOrderBy.push({ id: Prisma.SortOrder.desc });

  const paginatedArgs = {
    ...findManyOptions,
    where,
    orderBy: parsedOrderBy,
    take: pageSize,
    skip: (page - 1) * pageSize,
  } as unknown as FindManyArgs<T>;

  const [data, total] = await Promise.all([
    delegate.findMany(paginatedArgs) as Promise<TItem[]>,
    delegate.count({ where } as Args<T, 'count'>),
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

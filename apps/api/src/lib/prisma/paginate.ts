import { type AnyDelegate, type Args, Prisma, type Result } from '@template/db';
import { orderablePaths } from '@template/db/lens/orderablePaths';
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
  orNullFields?: string[];
  where?: FindManyWhere<T>;
  // Caller-supplied order keys, applied at the FRONT (priority) — e.g. server-set
  // scope ordering. Merged ahead of the client's orderBy, then deduped by top-level
  // key, so caller keys always win over a client sort on the same key.
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
  const { orderBy: callerOrderByOption, orNullFields, ...findManyOptions } = (options ?? {}) as PaginateOptions<T>;

  const bracketQuery = c.get('bracketQuery');
  const searchFields = isBracketQueryRecord(bracketQuery.searchFields) ? bracketQuery.searchFields : query.searchFields;

  // paginate is lens-only: every paginated route declares a filterLens, so
  // searchable + orderable validation always applies — there's no unvalidated
  // escape hatch where a client `orderBy`/`searchFields` reaches Prisma raw.
  const filterLens = c.get('filterLens');
  if (!filterLens) {
    throw new Error('paginate: route must declare a filterLens (readRoute({ filterLens: … })).');
  }
  const skipFieldValidation = isSuperadmin(c);

  const searchWhere = buildWhereClause({ filterLens, search, searchFields, skipFieldValidation, orNullFields });

  const baseWhere = (findManyOptions.where ?? {}) as Record<string, unknown>;
  // Wrap both in AND so caller-supplied AND/OR clauses aren't overwritten by
  // search's AND. Prisma flattens nested AND, so `{ AND: [a, b] }` is exactly
  // `a` and `b` both holding — no semantic change vs the old spread when
  // neither side had AND/OR keys.
  const where = { AND: [baseWhere, searchWhere] } as FindManyWhere<T>;

  // Compose orderBy = caller front-keys + client orderBy + default tiebreaker,
  // then dedupe by top-level key left-to-right (first occurrence wins) so a
  // client sort never doubles a caller/default key. Client orderBy is validated
  // against the lens' orderable allowlist unless the caller is a superadmin.
  const callerOrderBy = callerOrderByOption
    ? ((Array.isArray(callerOrderByOption) ? callerOrderByOption : [callerOrderByOption]) as Record<
        string,
        Prisma.SortOrder
      >[])
    : [];
  const clientOrderBy = rawOrderBy
    ? (parseOrderBy(rawOrderBy, skipFieldValidation ? undefined : orderablePaths(filterLens)) as Record<
        string,
        Prisma.SortOrder
      >[])
    : [];
  const tiebreaker: Record<string, Prisma.SortOrder>[] = [{ id: Prisma.SortOrder.desc }];

  const seenKeys = new Set<string>();
  const parsedOrderBy = [...callerOrderBy, ...clientOrderBy, ...tiebreaker].filter((entry) => {
    const key = Object.keys(entry)[0];
    if (!key || seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

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

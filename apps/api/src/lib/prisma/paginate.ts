/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:routeTemplates
 */
import { type LensNarrowing, lensRequiredBindings, type RuleValue, resolveLensBindings } from '@inixiative/json-rules';
import type { AnyDelegate, Args, Result } from '@template/db';
import { rootLens } from '@template/db/lens';
import { getValidatedQuery, type ValidatedContext } from '#/lib/context/getValidatedData';
import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { makeError } from '#/lib/errors';
import { buildOrderBy } from '#/lib/prisma/buildOrderBy';
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';
import { hasSoftDelete, mentionsDeletedAt, scopeSoftDeleteInclude } from '#/lib/prisma/softDeleteScope';
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
  bindings?: Record<string, RuleValue>;
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
  const {
    orderBy: callerOrderByOption,
    orNullFields,
    bindings,
    ...findManyOptions
  } = (options ?? {}) as PaginateOptions<T>;

  const bracketQuery = c.get('bracketQuery');
  const searchFields = isBracketQueryRecord(bracketQuery.searchFields) ? bracketQuery.searchFields : query.searchFields;

  const declaredLens = c.get('filterLens');
  if (!declaredLens) {
    throw makeError({
      status: 500,
      message: 'paginate: route must declare a filterLens (readRoute({ filterLens: … })).',
    });
  }
  const required = lensRequiredBindings(declaredLens);
  const missing = [...required].filter((name) => bindings?.[name] === undefined);
  if (missing.length) {
    throw makeError({
      status: 500,
      message: `paginate: lens requires bindings not provided: ${missing.join(', ')}`,
    });
  }
  const filterLens = required.size
    ? (resolveLensBindings(declaredLens, bindings ?? {}) as LensNarrowing)
    : declaredLens;
  // Superadmin bypasses both the searchable-fields whitelist and the injected
  // `deletedAt: null` live scope.
  const superadmin = isSuperadmin(c);

  const baseWhere = (findManyOptions.where ?? {}) as Record<string, unknown>;
  const searchWhere = await buildWhereClause({
    filterLens,
    search,
    searchFields,
    skipFieldValidation: superadmin,
    orNullFields,
  });

  // Root live scope composes here (paginate owns baseWhere): an explicit `deletedAt`
  // anywhere in the composed where wins over the injection.
  const and: Record<string, unknown>[] = [baseWhere, searchWhere as Record<string, unknown>];
  if (!superadmin && hasSoftDelete(rootLens(filterLens).model) && !and.some(mentionsDeletedAt)) {
    and.push({ deletedAt: null });
  }
  const where = { AND: and } as FindManyWhere<T>;

  // Relation payloads read live rows too: fold `deletedAt: null` onto every
  // to-many level of the caller's include/select trees.
  if (!superadmin) {
    const model = rootLens(filterLens).model;
    const trees = findManyOptions as Record<string, unknown>;
    for (const key of ['include', 'select'] as const) {
      const tree = trees[key];
      if (tree && typeof tree === 'object') trees[key] = scopeSoftDeleteInclude(model, tree as Record<string, unknown>);
    }
  }

  const orderBy = buildOrderBy({
    callerOrderBy: callerOrderByOption,
    clientOrderBy: rawOrderBy,
  });

  const paginatedArgs = {
    ...findManyOptions,
    where,
    orderBy,
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

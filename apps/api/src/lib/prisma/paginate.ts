/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:routeTemplates
 */
import { fieldAtPath, isScalarField, modelOf } from '@inixiative/field-map';
import {
  andWhere,
  bindLens,
  getLensRoot,
  listLensBindings,
  type RuleValue,
} from '@inixiative/json-rules';
import type { AnyDelegate, Args, Result } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import { stableHash } from '@template/shared/utils';
import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { type ValidatedContext, validatedQuery } from '#/lib/context/validatedRequestData';
import { makeError } from '#/lib/errors';
import { applyFilterLensWheresToPrismaWhere } from '#/lib/prisma/applyFilterLensWheresToPrismaWhere';
import { buildOrderBy } from '#/lib/prisma/buildOrderBy';
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';
import {
  assertChainMatches,
  assertFilterMatches,
  buildKeysetWhere,
  decodeCursor,
  encodeCursor,
  hydrateCursorValues,
  type SortKey,
} from '#/lib/prisma/keysetCursor';
import type { BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

const DEFAULT_CURSOR_PAGE_SIZE = 100;

type CursorPaginationQuery = {
  pageSize?: number;
  cursor?: string;
  search?: string;
  searchFields?: BracketQueryRecord;
  orderBy?: string[];
};

type PaginationQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  searchFields?: BracketQueryRecord;
  orderBy?: string[];
};

type FindManyArgs<T extends AnyDelegate> = Args<T, 'findMany'> & object;
type FindManyWhere<T extends AnyDelegate> = FindManyArgs<T> extends { where?: infer W } ? W : never;
type FindManyOrderBy<T extends AnyDelegate> =
  FindManyArgs<T> extends { orderBy?: infer O } ? O : never;
type FindManyInclude<T extends AnyDelegate> =
  FindManyArgs<T> extends { include?: infer I } ? I : never;
type FindManyOmit<T extends AnyDelegate> = FindManyArgs<T> extends { omit?: infer O } ? O : never;
type FindManySelect<T extends AnyDelegate> =
  FindManyArgs<T> extends { select?: infer S } ? S : never;
type FindManyCursor<T extends AnyDelegate> =
  FindManyArgs<T> extends { cursor?: infer C } ? C : never;
type FindManyDistinct<T extends AnyDelegate> =
  FindManyArgs<T> extends { distinct?: infer D } ? D : never;
type PaginateOptions<
  T extends AnyDelegate,
  Include extends FindManyInclude<T> | undefined = FindManyInclude<T> | undefined,
  Select extends FindManySelect<T> | undefined = FindManySelect<T> | undefined,
  OmitOpt extends FindManyOmit<T> | undefined = FindManyOmit<T> | undefined,
> = {
  orNullFields?: string[];
  searchPaths?: string[];
  bindings?: Record<string, RuleValue>;
  where?: FindManyWhere<T>;
  orderBy?: FindManyOrderBy<T>;
  include?: Include;
  omit?: OmitOpt;
  select?: Select;
  cursor?: FindManyCursor<T>;
  distinct?: FindManyDistinct<T>;
};

type PaginateResultItem<
  T extends AnyDelegate,
  TItem,
  Include,
  Select,
  OmitOpt,
> = unknown extends TItem
  ? Result<
      T,
      ([Include] extends [undefined]
        ? unknown
        : FindManyInclude<T> extends Include
          ? unknown
          : { include: Include }) &
        ([Select] extends [undefined]
          ? unknown
          : FindManySelect<T> extends Select
            ? unknown
            : { select: Select }) &
        ([OmitOpt] extends [undefined]
          ? unknown
          : FindManyOmit<T> extends OmitOpt
            ? unknown
            : { omit: OmitOpt }),
      'findMany'
    >[number]
  : TItem;

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

// Everything up to the terminal findMany is shared by offset and cursor mode: lens binding
// resolution, search composition, authorization narrowing and not-deleted scope. Only the tail differs.
const composeScopedFindMany = async <T extends AnyDelegate>(
  c: ValidatedContext<'query', PaginationQuery>,
  options?: PaginateOptions<T>,
) => {
  const query = validatedQuery(c);
  const { search } = query;
  const {
    orderBy: callerOrderByOption,
    orNullFields,
    searchPaths,
    bindings,
    ...findManyOptions
  } = (options ?? {}) as PaginateOptions<T>;

  const bracketQuery = c.get('bracketQuery');
  const searchFields = isBracketQueryRecord(bracketQuery.searchFields)
    ? bracketQuery.searchFields
    : query.searchFields;

  const declaredLens = c.get('filterLens');
  if (!declaredLens) {
    throw makeError({
      status: 500,
      message: 'paginate: route must declare a filterLens (readRoute({ filterLens: … })).',
    });
  }
  const required = listLensBindings(declaredLens);
  const missing = required.filter((name) => bindings?.[name] === undefined);
  if (missing.length) {
    throw makeError({
      status: 500,
      message: `paginate: lens requires bindings not provided: ${missing.join(', ')}`,
    });
  }
  const filterLens = required.length ? bindLens(declaredLens, bindings ?? {}) : declaredLens;
  const superadmin = isSuperadmin(c);

  const model = getLensRoot(filterLens).model;
  const baseWhere = (findManyOptions.where ?? {}) as Record<string, unknown>;
  const searchWhere = buildWhereClause({
    filterLens,
    search,
    searchFields,
    searchPaths,
    skipFieldValidation: superadmin,
    orNullFields,
  });

  // Lens relation wheres are authorization scope — they apply on superadmin endpoints too.
  const composed = await applyFilterLensWheresToPrismaWhere(
    filterLens,
    andWhere([baseWhere, searchWhere as Record<string, unknown>]),
  );
  const where = composed as FindManyWhere<T>;

  return { where, model, findManyOptions, callerOrderByOption };
};

export const paginate = async <
  T extends AnyDelegate,
  TItem = unknown,
  C extends ValidatedContext<'query', PaginationQuery> = ValidatedContext<'query', PaginationQuery>,
  const Include extends FindManyInclude<T> | undefined = FindManyInclude<T> | undefined,
  const Select extends FindManySelect<T> | undefined = FindManySelect<T> | undefined,
  const OmitOpt extends FindManyOmit<T> | undefined = FindManyOmit<T> | undefined,
>(
  c: C,
  delegate: T,
  options?: PaginateOptions<T, Include, Select, OmitOpt>,
): Promise<PaginatedResult<PaginateResultItem<T, TItem, Include, Select, OmitOpt>>> => {
  const { page = 1, pageSize = 20, orderBy: rawOrderBy } = validatedQuery(c);
  const { where, findManyOptions, callerOrderByOption } = await composeScopedFindMany(
    c,
    options as PaginateOptions<T> | undefined,
  );

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
    data: data as PaginateResultItem<T, TItem, Include, Select, OmitOpt>[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

// why: a keyset chain must end in a non-null unique column - a nullable or non-unique tiebreaker
// why: either voids the boundary comparison or silently skips rows on ties. That column is the
// why: model's own @id, read off prismaMap rather than assumed by name.
const primaryKeysOf = (model: string): string[] =>
  Object.entries(modelOf(prismaMap, model)?.fields ?? {})
    .filter(([, field]) => isScalarField(field) && field.isId && field.isRequired)
    .map(([name]) => name);

export const withTotalOrder = (model: string, chain: SortKey[]): SortKey[] => {
  const lastKey = chain[chain.length - 1]?.[0];
  const lastField = lastKey ? fieldAtPath(prismaMap, model, lastKey) : undefined;
  if (lastField && isScalarField(lastField) && lastField.isId && lastField.isRequired) return chain;

  const [primaryKey, ...rest] = primaryKeysOf(model);
  if (!primaryKey || rest.length > 0) {
    throw makeError({
      status: 500,
      message: `cursorPaginate: ${model} has no single non-null @id column to anchor the keyset - pin its primary key via options.orderBy.`,
    });
  }

  return chain.some(([key]) => key === primaryKey) ? chain : [...chain, [primaryKey, 'asc']];
};

const normalizeChain = (orderBy: unknown): SortKey[] => {
  const entries = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []) as Record<
    string,
    unknown
  >[];
  const chain: SortKey[] = [];
  for (const entry of entries) {
    const key = Object.keys(entry)[0];
    if (!key) continue;
    const dir = entry[key];
    if (dir === 'asc' || dir === 'desc') chain.push([key, dir]);
  }
  return chain;
};

type CursorPaginatedResult<T> = {
  data: T[];
  pagination: { pageSize: number; hasMore: boolean; nextCursor: string | null };
};

// Keyset pagination: seeks to the last-seen position via an index range scan rather than reading
// and discarding `skip` rows, so it is O(pageSize) at any depth and stable under concurrent
// writes. No count() is issued — `hasMore` comes from fetching one row past the page.
export const cursorPaginate = async <
  T extends AnyDelegate,
  TItem = unknown,
  C extends ValidatedContext<'query', CursorPaginationQuery> = ValidatedContext<
    'query',
    CursorPaginationQuery
  >,
  const Include extends FindManyInclude<T> | undefined = FindManyInclude<T> | undefined,
  const Select extends FindManySelect<T> | undefined = FindManySelect<T> | undefined,
  const OmitOpt extends FindManyOmit<T> | undefined = FindManyOmit<T> | undefined,
>(
  c: C,
  delegate: T,
  options?: PaginateOptions<T, Include, Select, OmitOpt>,
): Promise<CursorPaginatedResult<PaginateResultItem<T, TItem, Include, Select, OmitOpt>>> => {
  const { pageSize = DEFAULT_CURSOR_PAGE_SIZE, cursor } = validatedQuery(c);
  const { where, model, findManyOptions, callerOrderByOption } = await composeScopedFindMany(
    c as unknown as ValidatedContext<'query', PaginationQuery>,
    options as PaginateOptions<T> | undefined,
  );
  const chain = withTotalOrder(model, normalizeChain(callerOrderByOption));
  // The token binds to the composed filter — lens narrowing, search, not-deleted scope and the caller's
  // where all included — so "same query?" is answered by the system that owns the query, not by
  // the request params.
  const filterHash = stableHash({ model, where });

  let scopedWhere = where as Record<string, unknown>;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    assertChainMatches(decoded.k, chain);
    assertFilterMatches(decoded.f, filterHash);
    scopedWhere = andWhere([
      where as Record<string, unknown>,
      buildKeysetWhere(chain, hydrateCursorValues(model, chain, decoded.p)),
    ]);
  }

  const rows = (await delegate.findMany({
    ...findManyOptions,
    where: scopedWhere,
    orderBy: chain.map(([key, dir]) => ({ [key]: dir })),
    take: pageSize + 1,
  } as unknown as FindManyArgs<T>)) as TItem[];

  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = data[data.length - 1] as Record<string, unknown> | undefined;
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor(
          chain,
          chain.map(([key]) => lastRow[key]),
          filterHash,
        )
      : null;

  return {
    data: data as PaginateResultItem<T, TItem, Include, Select, OmitOpt>[],
    pagination: { pageSize, hasMore, nextCursor },
  };
};

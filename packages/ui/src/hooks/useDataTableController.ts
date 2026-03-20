import { ARRAY_FIELD_OPERATORS, type ArrayFieldOperator } from '@template/shared/bracketQuery';
import type { DataTableConfig, SearchMode } from '@template/ui/lib/makeDataTableConfig';
import { serializeBracketQuery } from '@template/ui/lib/serializeBracketQuery';
import { useMemo, useState } from 'react';

export type FilterState = {
  /** Array operators (in/notIn) take all values; scalar operators (contains/equals/startsWith/endsWith) use values[0] */
  operator: ArrayFieldOperator | 'equals' | 'contains' | 'startsWith' | 'endsWith';
  values: string[];
};

/**
 * Recursively set a value at a dot-notation path in a nested object.
 * 'sourceUser.email' → { sourceUser: { email: value } }
 */
const setPath = (obj: Record<string, unknown>, path: string[], value: unknown): void => {
  if (path.length === 1) {
    obj[path[0]] = value;
    return;
  }
  const [head, ...rest] = path;
  if (!obj[head] || typeof obj[head] !== 'object' || Array.isArray(obj[head])) {
    obj[head] = {};
  }
  setPath(obj[head] as Record<string, unknown>, rest, value);
};

export type DataTableController = {
  search: string;
  filters: Record<string, FilterState>;
  orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>;
  page: number;
  pageSize: number;
  setSearch: (s: string) => void;
  setFilter: (field: string, state: FilterState | null) => void;
  toggleOrderBy: (field: string) => void;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  reset: () => void;
  /**
   * Pass as the `query` argument to context query factories.
   * Contains pre-serialized bracket-notation keys for nested searchFields,
   * so the hey-api client can handle them as flat string params.
   */
  query: Record<string, unknown>;
};

const DEFAULT_PAGE_SIZE = 20;

/**
 * Serialize controller state into the flat query object the SDK expects.
 *
 * Bracket-notation keys (e.g. 'searchFields[status][in]') are pre-serialized
 * here because hey-api's deepObject serializer only handles one level of nesting.
 * serializeBracketQuery handles the recursive bracket expansion, then we convert
 * URLSearchParams → Record<string, string | string[]> so the SDK can repeat array
 * values as separate query params (searchFields[x][in]=a&searchFields[x][in]=b).
 */
export const buildQuery = (
  search: string,
  searchMode: SearchMode,
  searchableFields: string[],
  filters: Record<string, FilterState>,
  orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>,
  page: number,
  pageSize: number,
  adminMode = false,
): Record<string, unknown> => {
  const query: Record<string, unknown> = { page, pageSize };

  // Combined search: top-level param, API ORs contains across all searchable fields
  if (search && searchMode === 'combined') {
    query.search = search;
  }

  // Build nested filter object for bracket serialization
  const nested: Record<string, unknown> = {};

  // Field mode: targeted contains per searchable field
  if (search && searchMode === 'field') {
    for (const field of searchableFields) {
      nested[field] = { contains: search };
    }
  }

  // Filters: supports flat fields (status), dot-notation relations (sourceUser.email)
  // Array operators (in/notIn) pass the full values array; scalar operators use values[0]
  for (const [field, { operator, values }] of Object.entries(filters)) {
    if (values.length > 0) {
      const filterValue = (ARRAY_FIELD_OPERATORS as readonly string[]).includes(operator)
        ? { [operator]: values }
        : { [operator]: values[0] };
      setPath(nested, field.split('.'), filterValue);
    }
  }

  // adminMode → filters[...] (direct Prisma, no validation)
  // non-admin  → searchFields[...] (validated against searchableFields whitelist)
  const bracketPrefix = adminMode ? 'filters' : 'searchFields';

  if (Object.keys(nested).length > 0) {
    const params = serializeBracketQuery({ [bracketPrefix]: nested });
    for (const key of new Set(params.keys())) {
      const allValues = params.getAll(key);
      query[key] = allValues.length === 1 ? allValues[0] : allValues;
    }
  }

  // orderBy: 'field:direction' string array
  if (orderBy.length > 0) {
    query.orderBy = orderBy.map(({ field, direction }) => `${field}:${direction}`);
  }

  return query;
};

/**
 * Manages search, filter, sort, and pagination state for server-side data tables.
 *
 * Pass `controller.query` as the second argument to context query factories:
 *   const queries = tokenContextQueries(context, controller.query);
 *
 * Config is treated as stable — pass a memoized or module-level config.
 */
export const useDataTableController = (
  config: DataTableConfig,
  options?: { defaultPageSize?: number },
): DataTableController => {
  const defaultPageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;

  const [search, setSearchRaw] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterState>>({});
  const [orderBy, setOrderByState] = useState<Array<{ field: string; direction: 'asc' | 'desc' }>>(
    config.defaultOrderBy ?? [],
  );
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);

  const setSearch = (s: string) => {
    setSearchRaw(s);
    setPageRaw(1);
  };

  const setFilter = (field: string, state: FilterState | null) => {
    setFilters((prev) => {
      if (!state || state.values.length === 0) {
        const { [field]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [field]: state };
    });
    setPageRaw(1);
  };

  // Cycles: none → asc → desc → none (removes field from sort)
  const toggleOrderBy = (field: string) => {
    setOrderByState((prev) => {
      const existing = prev.find((o) => o.field === field);
      if (!existing) return [...prev, { field, direction: 'asc' }];
      if (existing.direction === 'asc') return prev.map((o) => (o.field === field ? { ...o, direction: 'desc' } : o));
      return prev.filter((o) => o.field !== field);
    });
  };

  const setPage = (p: number) => setPageRaw(p);

  const setPageSize = (s: number) => {
    setPageSizeRaw(s);
    setPageRaw(1);
  };

  const reset = () => {
    setSearchRaw('');
    setFilters({});
    setOrderByState(config.defaultOrderBy ?? []);
    setPageRaw(1);
    setPageSizeRaw(defaultPageSize);
  };

  const { searchMode, searchableFields, adminMode } = config;

  const query = useMemo(
    () => buildQuery(search, searchMode, searchableFields, filters, orderBy, page, pageSize, adminMode),
    // searchableFields is a stable array reference from makeDataTableConfig (module-level const)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, searchMode, searchableFields, filters, orderBy, page, pageSize, adminMode],
  );

  return {
    search,
    filters,
    orderBy,
    page,
    pageSize,
    setSearch,
    setFilter,
    toggleOrderBy,
    setPage,
    setPageSize,
    reset,
    query,
  };
};

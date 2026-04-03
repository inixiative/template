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

export type TableFilters = {
  search: string;
  filters: Record<string, FilterState>;
  orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>;
  setSearch: (s: string) => void;
  setFilter: (field: string, state: FilterState | null) => void;
  toggleOrderBy: (field: string) => void;
  reset: () => void;
  /**
   * The filter/sort portion of the query object (no page/pageSize).
   * Paginated controllers add page params; infinite controllers pass
   * this to their queryFn for server-side filtering.
   */
  filterQuery: Record<string, unknown>;
};

/**
 * Serialize filter/sort state into the flat query object the SDK expects.
 * This is the shared portion — no page/pageSize included.
 */
export const buildFilterQuery = (
  search: string,
  searchMode: SearchMode,
  searchableFields: string[],
  filters: Record<string, FilterState>,
  orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>,
  adminMode = false,
): Record<string, unknown> => {
  const query: Record<string, unknown> = {};

  if (search && searchMode === 'combined' && !adminMode && searchableFields.length > 0) {
    query.search = search;
  }

  const nested: Record<string, unknown> = {};

  if (search && searchMode === 'field') {
    for (const field of searchableFields) {
      nested[field] = { contains: search };
    }
  }

  for (const [field, { operator, values }] of Object.entries(filters)) {
    if (values.length > 0) {
      const filterValue = (ARRAY_FIELD_OPERATORS as readonly string[]).includes(operator)
        ? { [operator]: values }
        : { [operator]: values[0] };
      setPath(nested, field.split('.'), filterValue);
    }
  }

  const bracketPrefix = adminMode ? 'filters' : 'searchFields';

  if (Object.keys(nested).length > 0) {
    const params = serializeBracketQuery({ [bracketPrefix]: nested });
    for (const key of new Set(params.keys())) {
      const allValues = params.getAll(key);
      query[key] = allValues.length === 1 ? allValues[0] : allValues;
    }
  }

  if (orderBy.length > 0) {
    query.orderBy = orderBy.map(({ field, direction }) => `${field}:${direction}`);
  }

  return query;
};

/**
 * Shared search, filter, and sort state for data tables.
 * Used by both usePaginatedTableController and useInfiniteTableController.
 *
 * `onFiltersChange` is called whenever search, filter, or sort state changes.
 * Paginated controllers use this to reset to page 1. Infinite controllers
 * use this to reset/invalidate the query.
 */
export const useTableFilters = (
  config: DataTableConfig,
  onFiltersChange?: () => void,
): TableFilters => {
  const [search, setSearchRaw] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterState>>({});
  const [orderBy, setOrderByState] = useState<Array<{ field: string; direction: 'asc' | 'desc' }>>(
    config.defaultOrderBy ?? [],
  );

  const setSearch = (s: string) => {
    setSearchRaw(s);
    onFiltersChange?.();
  };

  const setFilter = (field: string, state: FilterState | null) => {
    setFilters((prev) => {
      if (!state || state.values.length === 0) {
        const { [field]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [field]: state };
    });
    onFiltersChange?.();
  };

  const toggleOrderBy = (field: string) => {
    setOrderByState((prev) => {
      const existing = prev.find((o) => o.field === field);
      if (!existing) return [...prev, { field, direction: 'asc' }];
      if (existing.direction === 'asc') return prev.map((o) => (o.field === field ? { ...o, direction: 'desc' } : o));
      return prev.filter((o) => o.field !== field);
    });
    onFiltersChange?.();
  };

  const reset = () => {
    setSearchRaw('');
    setFilters({});
    setOrderByState(config.defaultOrderBy ?? []);
    onFiltersChange?.();
  };

  const { searchMode, searchableFields, adminMode } = config;

  const filterQuery = useMemo(
    () => buildFilterQuery(search, searchMode, searchableFields, filters, orderBy, adminMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, searchMode, searchableFields, filters, orderBy, adminMode],
  );

  return {
    search,
    filters,
    orderBy,
    setSearch,
    setFilter,
    toggleOrderBy,
    reset,
    filterQuery,
  };
};

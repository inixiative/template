import { buildFilterQuery, type FilterState } from '@template/ui/lib/buildFilterQuery';
import type { DataConfig } from '@template/ui/lib/makeDataConfig';
import { useMemo, useState } from 'react';

export type DataFiltersInitialState = {
  search?: string;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
};

export type DataFilters = {
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
 * Shared search, filter, and sort state for data views.
 * Used by both usePaginatedData and useInfiniteData.
 *
 * `onFiltersChange` is called whenever search, filter, or sort state changes.
 * Paginated controllers use this to reset to page 1. Infinite controllers
 * use this to reset/invalidate the query.
 */
export const useDataFilters = (
  config: DataConfig,
  onFiltersChange?: () => void,
  initialState?: DataFiltersInitialState,
): DataFilters => {
  const [search, setSearchRaw] = useState(initialState?.search ?? '');
  const [filters, setFilters] = useState<Record<string, FilterState>>({});
  const [orderBy, setOrderByState] = useState<Array<{ field: string; direction: 'asc' | 'desc' }>>(
    initialState?.orderBy ?? config.defaultOrderBy ?? [],
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

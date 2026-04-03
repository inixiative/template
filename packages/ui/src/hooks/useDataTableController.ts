import type { DataTableConfig, SearchMode } from '@template/ui/lib/makeDataTableConfig';
import { type FilterState, type TableFilters, buildFilterQuery, useTableFilters } from '@template/ui/hooks/useTableFilters';
import { useMemo, useState } from 'react';

// Re-export for backward compatibility.
export type { FilterState } from '@template/ui/hooks/useTableFilters';

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
   * Includes page, pageSize, and serialized filter/sort params.
   */
  query: Record<string, unknown>;
};

const DEFAULT_PAGE_SIZE = 20;

/**
 * Backward-compatible buildQuery — adds page/pageSize to the filter query.
 * Kept for existing test coverage. New code should use buildFilterQuery
 * from useTableFilters directly.
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
): Record<string, unknown> => ({
  ...buildFilterQuery(search, searchMode, searchableFields, filters, orderBy, adminMode),
  page,
  pageSize,
});

/**
 * Manages search, filter, sort, and pagination state for server-side
 * paginated data tables.
 *
 * This is the paginated variant — page number is tracked in state
 * and included in the query object. For infinite scroll tables,
 * use useInfiniteTableController instead.
 *
 * @alias usePaginatedTableController
 */
export const useDataTableController = (
  config: DataTableConfig,
  options?: { defaultPageSize?: number },
): DataTableController => {
  const defaultPageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;

  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);

  const tableFilters = useTableFilters(config, () => setPageRaw(1));

  const setPage = (p: number) => setPageRaw(p);

  const setPageSize = (s: number) => {
    setPageSizeRaw(s);
    setPageRaw(1);
  };

  const reset = () => {
    tableFilters.reset();
    setPageRaw(1);
    setPageSizeRaw(defaultPageSize);
  };

  const query = useMemo(
    () => ({ ...tableFilters.filterQuery, page, pageSize }),
    [tableFilters.filterQuery, page, pageSize],
  );

  return {
    search: tableFilters.search,
    filters: tableFilters.filters,
    orderBy: tableFilters.orderBy,
    page,
    pageSize,
    setSearch: tableFilters.setSearch,
    setFilter: tableFilters.setFilter,
    toggleOrderBy: tableFilters.toggleOrderBy,
    setPage,
    setPageSize,
    reset,
    query,
  };
};

/** @alias useDataTableController */
export const usePaginatedTableController = useDataTableController;

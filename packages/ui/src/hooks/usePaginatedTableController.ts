import type { DataTableConfig } from '@template/ui/lib/makeDataTableConfig';
import type { PaginationProps } from '@template/ui/components/primitives/Pagination';
import { type TableFilters, useTableFilters } from '@template/ui/hooks/useTableFilters';
import { useMemo, useState } from 'react';

export type PaginatedTableController = TableFilters & {
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  reset: () => void;
  /** Full query object with page, pageSize, and filter/sort params. */
  query: Record<string, unknown>;
  /**
   * Produces PaginationProps ready to spread into <Table pagination={...} />.
   * Pass the total record count from your query response.
   */
  paginationProps: (total: number, pageSizeOptions?: number[]) => PaginationProps;
};

const DEFAULT_PAGE_SIZE = 20;

/**
 * Search, filter, sort, and page-number pagination for server-side tables.
 *
 * For infinite scroll tables, use useInfiniteTableController instead.
 *
 * Usage:
 * ```tsx
 * const controller = usePaginatedTableController(config);
 * const { data } = useQuery(queries.list(controller.query));
 *
 * <Table
 *   columns={columns}
 *   data={data.items}
 *   keyExtractor={(item) => item.id}
 *   pagination={controller.paginationProps(data.total)}
 * />
 * ```
 */
export const usePaginatedTableController = (
  config: DataTableConfig,
  options?: { defaultPageSize?: number },
): PaginatedTableController => {
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

  const paginationProps = (total: number, pageSizeOptions?: number[]): PaginationProps => ({
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    onPageChange: setPage,
    totalRecords: total,
    pageSize,
    pageSizeOptions: pageSizeOptions ?? [10, 20, 50, 100],
    onPageSizeChange: setPageSize,
  });

  return {
    ...tableFilters,
    page,
    pageSize,
    setPage,
    setPageSize,
    reset,
    query,
    paginationProps,
  };
};

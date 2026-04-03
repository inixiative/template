import type { QueryKey } from '@tanstack/react-query';
import type { DataTableConfig } from '@template/ui/lib/makeDataTableConfig';
import {
  type InfiniteTablePage,
  type UseInfiniteTableQueryResult,
  useInfiniteTableQuery,
} from '@template/ui/hooks/useInfiniteTableQuery';
import { type TableFilters, useTableFilters } from '@template/ui/hooks/useTableFilters';

export type UseInfiniteTableControllerOptions<TItem> = {
  config: DataTableConfig;
  queryKey: QueryKey;
  /**
   * Fetch function for a single page. Receives the page param and
   * the current filter query (search/filter/sort params serialized
   * for the server). Merge filterQuery into your fetch call.
   */
  queryFn: (pageParam: number, filterQuery: Record<string, unknown>) => Promise<InfiniteTablePage<TItem>>;
  enabled?: boolean;
};

export type InfiniteTableController<TItem> = TableFilters & {
  /** Flattened array of all items across loaded pages. */
  data: TItem[];
  /** Number of pages currently in cache. */
  pageCount: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  total: number | undefined;
  queryKey: QueryKey;
};

/**
 * Combines useTableFilters (search/filter/sort) with useInfiniteTableQuery
 * (TanStack Query infinite pagination) into a single controller.
 *
 * When filters change, the query key changes (because filterQuery is
 * included), which causes TanStack Query to refetch from page 0.
 *
 * Usage:
 * ```tsx
 * const controller = useInfiniteTableController({
 *   config: tableConfig,
 *   queryKey: ['users'],
 *   queryFn: (pageParam, filterQuery) =>
 *     fetchUsers({ ...filterQuery, cursor: pageParam }),
 * });
 *
 * <Table
 *   columns={columns}
 *   data={controller.data}
 *   keyExtractor={(u) => u.id}
 *   infiniteScroll={{
 *     onLoadMore: controller.fetchNextPage,
 *     hasMore: controller.hasNextPage,
 *     isLoading: controller.isFetchingNextPage,
 *   }}
 * />
 * ```
 */
export function useInfiniteTableController<TItem>(
  options: UseInfiniteTableControllerOptions<TItem>,
): InfiniteTableController<TItem> {
  const { config, queryKey, queryFn, enabled = true } = options;

  const tableFilters = useTableFilters(config);

  // Include filterQuery in the query key so filter changes trigger a refetch
  // from page 0 (TanStack Query treats a new key as a new query).
  const fullQueryKey = [...queryKey, tableFilters.filterQuery];

  const query = useInfiniteTableQuery({
    queryKey: fullQueryKey,
    queryFn: (pageParam) => queryFn(pageParam, tableFilters.filterQuery),
    enabled,
  });

  return {
    ...tableFilters,
    data: query.data,
    pageCount: query.pageCount,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    total: query.total,
    queryKey: fullQueryKey,
  };
}

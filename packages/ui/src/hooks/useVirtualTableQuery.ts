import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as React from 'react';

export type PageParam = number;

export type VirtualTablePage<TItem> = {
  data: TItem[];
  /** Total number of items across all pages, if known. */
  total?: number;
  /** Next page cursor/number, or undefined if no more pages. */
  nextPage?: PageParam;
};

export type UseVirtualTableQueryOptions<TItem> = {
  queryKey: QueryKey;
  /** Fetch function for a single page. Receives the page param (starts at 0). */
  queryFn: (pageParam: PageParam) => Promise<VirtualTablePage<TItem>>;
  /** Whether the query is enabled. Defaults to true. */
  enabled?: boolean;
};

export type VirtualTablePageLocation = {
  pageIndex: number;
  indexInPage: number;
};

export type UseVirtualTableQueryResult<TItem> = {
  /** Flattened array of all items across loaded pages. */
  data: TItem[];
  /** Whether the initial load is in progress. */
  isLoading: boolean;
  /** Whether a subsequent page is being fetched. */
  isFetchingNextPage: boolean;
  /** Whether there are more pages available. */
  hasNextPage: boolean;
  /** Call to fetch the next page. Wire to VirtualTable's onLoadMore. */
  fetchNextPage: () => void;
  /** Total item count from the server, if available. */
  total: number | undefined;
  /**
   * Given a flat index, returns which page it belongs to and
   * its index within that page. Useful for building optimistic
   * mutation targets with useOptimisticMutation + createOptimisticListTarget.
   */
  locateItem: (flatIndex: number) => VirtualTablePageLocation | null;
  /** The raw infinite query data, for use with useOptimisticMutation targets. */
  queryKey: QueryKey;
};

export function useVirtualTableQuery<TItem>(
  options: UseVirtualTableQueryOptions<TItem>,
): UseVirtualTableQueryResult<TItem> {
  const { queryKey, queryFn, enabled = true } = options;

  const query = useInfiniteQuery<
    VirtualTablePage<TItem>,
    Error,
    InfiniteData<VirtualTablePage<TItem>>,
    QueryKey,
    PageParam
  >({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled,
  });

  const data = React.useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  const total = query.data?.pages[0]?.total;

  const locateItem = React.useCallback(
    (flatIndex: number): VirtualTablePageLocation | null => {
      if (!query.data) return null;
      let remaining = flatIndex;
      for (let pageIndex = 0; pageIndex < query.data.pages.length; pageIndex++) {
        const page = query.data.pages[pageIndex];
        if (remaining < page.data.length) {
          return { pageIndex, indexInPage: remaining };
        }
        remaining -= page.data.length;
      }
      return null;
    },
    [query.data],
  );

  return {
    data,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => query.fetchNextPage(),
    total,
    locateItem,
    queryKey,
  };
}

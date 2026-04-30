import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as React from 'react';

export type InfiniteDataPage<TItem> = {
  data: TItem[];
  /** Total number of records across all pages, if known. */
  total?: number;
  /** Next page cursor/number, or undefined if no more pages. */
  nextPage?: number;
};

export type UseInfiniteDataQueryOptions<TItem> = {
  queryKey: QueryKey;
  /** Fetch function for a single page. Receives the page param (starts at 0). */
  queryFn: (pageParam: number) => Promise<InfiniteDataPage<TItem>>;
  /** Whether the query is enabled. Defaults to true. */
  enabled?: boolean;
};

export type InfiniteDataPageLocation = {
  pageIndex: number;
  indexInPage: number;
};

export type UseInfiniteDataQueryResult<TItem> = {
  /** Flattened array of all items across loaded pages. */
  data: TItem[];
  /** Number of pages currently in cache. */
  pageCount: number;
  /** Whether the initial load is in progress. */
  isLoading: boolean;
  /** Whether a subsequent page is being fetched. */
  isFetchingNextPage: boolean;
  /** Whether there are more pages available. */
  hasNextPage: boolean;
  /** Call to fetch the next page. Wire to useInfiniteScrollTrigger's onLoadMore. */
  fetchNextPage: () => void;
  /** Total record count from the server, if available. */
  total: number | undefined;
  /**
   * Given a flat index, returns which page it belongs to and
   * its index within that page. Useful for optimistic mutations.
   */
  locateItem: (flatIndex: number) => InfiniteDataPageLocation | null;
  /** The query key, for use with cache mutation APIs. */
  queryKey: QueryKey;
};

/**
 * Wraps TanStack Query's useInfiniteQuery for paginated table data.
 * Returns a flat data array and pagination state. No virtualization —
 * all loaded items exist in the DOM.
 */
export function useInfiniteDataQuery<TItem>(
  options: UseInfiniteDataQueryOptions<TItem>,
): UseInfiniteDataQueryResult<TItem> {
  const { queryKey, queryFn, enabled = true } = options;

  const query = useInfiniteQuery<
    InfiniteDataPage<TItem>,
    Error,
    InfiniteData<InfiniteDataPage<TItem>>,
    QueryKey,
    number
  >({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled,
  });

  const data = React.useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  const pageCount = query.data?.pages.length ?? 0;

  // Read total from the most recent page that includes it.
  const total = React.useMemo(() => {
    if (!query.data) return undefined;
    for (let i = query.data.pages.length - 1; i >= 0; i--) {
      if (query.data.pages[i].total !== undefined) return query.data.pages[i].total;
    }
    return undefined;
  }, [query.data]);

  const locateItem = React.useCallback(
    (flatIndex: number): InfiniteDataPageLocation | null => locateItemInPages(query.data?.pages ?? [], flatIndex),
    [query.data],
  );

  return {
    data,
    pageCount,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => query.fetchNextPage(),
    total,
    locateItem,
    queryKey,
  };
}

/**
 * Given an array of pages and a flat index, returns which page it
 * belongs to and its index within that page. Exported for testing.
 */
export function locateItemInPages<TItem>(
  pages: InfiniteDataPage<TItem>[],
  flatIndex: number,
): InfiniteDataPageLocation | null {
  if (flatIndex < 0) return null;
  let remaining = flatIndex;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    if (remaining < page.data.length) {
      return { pageIndex, indexInPage: remaining };
    }
    remaining -= page.data.length;
  }
  return null;
}

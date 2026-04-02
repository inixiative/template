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
  /**
   * Unique key for history.state page count persistence. When set,
   * the loaded page count is saved to history.state on each fetch.
   * On back/forward navigation the hook re-fetches pages until it
   * reaches the previously loaded count. Fresh navigations (link
   * clicks) start from page 1 because history.state is empty.
   */
  stateKey?: string;
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

/** Read the saved page count from history.state, or 0 if absent. */
function readSavedPageCount(stateKey: string): number {
  try {
    const saved = window.history.state?.[stateKey];
    return typeof saved === 'number' ? saved : 0;
  } catch {
    return 0;
  }
}

/** Write the current page count into history.state. */
function persistPageCount(stateKey: string, count: number): void {
  try {
    const state = { ...window.history.state, [stateKey]: count };
    window.history.replaceState(state, '');
  } catch {
    // sandboxed iframe or SecurityError — skip
  }
}

export function useVirtualTableQuery<TItem>(
  options: UseVirtualTableQueryOptions<TItem>,
): UseVirtualTableQueryResult<TItem> {
  const { queryKey, queryFn, enabled = true, stateKey } = options;

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

  // Read the target page count once on mount (before any effects).
  const targetPageCountRef = React.useRef<number | null>(null);
  if (targetPageCountRef.current === null) {
    targetPageCountRef.current = stateKey ? readSavedPageCount(stateKey) : 0;
  }

  // Re-fetch pages one-at-a-time until we reach the saved count.
  // Each fetch updates the cursor, so the next effect cycle fetches the next page.
  const pageCount = query.data?.pages.length ?? 0;
  React.useEffect(() => {
    if (!stateKey || query.isFetchingNextPage || !query.hasNextPage) return;
    const target = targetPageCountRef.current ?? 0;
    if (pageCount > 0 && pageCount < target) {
      query.fetchNextPage();
    }
  }, [stateKey, pageCount, query.isFetchingNextPage, query.hasNextPage, query.fetchNextPage]);

  // Persist the loaded page count whenever it changes.
  React.useEffect(() => {
    if (!stateKey || pageCount === 0) return;
    persistPageCount(stateKey, pageCount);
  }, [stateKey, pageCount]);

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

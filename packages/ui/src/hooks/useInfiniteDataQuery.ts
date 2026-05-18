import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as React from 'react';

export type InfiniteDataPage<TItem> = {
  data: TItem[];
  total?: number;
  nextPage?: number;
};

export type UseInfiniteDataQueryOptions<TItem> = {
  queryKey: QueryKey;
  queryFn: (pageParam: number) => Promise<InfiniteDataPage<TItem>>;
  enabled?: boolean;
};

export type InfiniteDataPageLocation = {
  pageIndex: number;
  indexInPage: number;
};

export type UseInfiniteDataQueryResult<TItem> = {
  data: TItem[];
  pageCount: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  total: number | undefined;
  locateItem: (flatIndex: number) => InfiniteDataPageLocation | null;
  queryKey: QueryKey;
};

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

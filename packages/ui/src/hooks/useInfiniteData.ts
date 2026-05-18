import type { QueryKey } from '@tanstack/react-query';
import type { InfiniteScrollProps } from '@template/ui/components/primitives/Table';
import { type DataFilters, useDataFilters } from '@template/ui/hooks/useDataFilters';
import { type InfiniteDataPage, useInfiniteDataQuery } from '@template/ui/hooks/useInfiniteDataQuery';
import { useScrollState } from '@template/ui/hooks/useScrollState';
import type { DataConfig } from '@template/ui/lib/makeDataConfig';
import * as React from 'react';
import { useRef } from 'react';

export type UseInfiniteDataOptions<TItem> = {
  config: DataConfig;
  queryKey: QueryKey;
  queryFn: (pageParam: number, filterQuery: Record<string, unknown>) => Promise<InfiniteDataPage<TItem>>;
  enabled?: boolean;
  sectionId?: string;
  scrollRestore?: boolean;
};

export type InfiniteDataResult<TItem> = DataFilters & {
  data: TItem[];
  pageCount: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  total: number | undefined;
  queryKey: QueryKey;
  infiniteScrollProps: InfiniteScrollProps;
  layoutProps: {
    sectionId: string | undefined;
    scrollRef: React.RefObject<HTMLDivElement | null>;
  };
  sectionId: string | undefined;
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

export function useInfiniteData<TItem>(options: UseInfiniteDataOptions<TItem>): InfiniteDataResult<TItem> {
  const { config, queryKey, queryFn, enabled = true, sectionId, scrollRestore } = options;

  const shouldRestoreScroll = scrollRestore ?? sectionId != null;

  const dataFilters = useDataFilters(config);

  // Include filterQuery in the query key so filter changes trigger a refetch
  // from page 0 (TanStack Query treats a new key as a new query).
  const fullQueryKey = [...queryKey, dataFilters.filterQuery];

  const query = useInfiniteDataQuery({
    queryKey: fullQueryKey,
    queryFn: (pageParam) => queryFn(pageParam, dataFilters.filterQuery),
    enabled,
  });

  // Scroll restoration.
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollState({
    id: sectionId ?? 'default',
    scrollRef,
    ready: !query.isLoading,
    enabled: shouldRestoreScroll,
  });

  const infiniteScrollProps: InfiniteScrollProps = React.useMemo(
    () => ({
      onLoadMore: query.fetchNextPage,
      hasMore: query.hasNextPage,
      isLoading: query.isFetchingNextPage,
    }),
    [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage],
  );

  const layoutProps = React.useMemo(() => ({ sectionId, scrollRef }), [sectionId]);

  return {
    ...dataFilters,
    data: query.data,
    pageCount: query.pageCount,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    total: query.total,
    queryKey: fullQueryKey,
    infiniteScrollProps,
    layoutProps,
    sectionId,
    scrollRef,
  };
}

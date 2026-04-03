import type { QueryKey } from '@tanstack/react-query';
import type { DataConfig } from '@template/ui/lib/makeDataConfig';
import type { InfiniteScrollProps } from '@template/ui/components/primitives/Table';
import {
  type InfiniteDataPage,
  useInfiniteDataQuery,
} from '@template/ui/hooks/useInfiniteDataQuery';
import { type DataFilters, useDataFilters } from '@template/ui/hooks/useDataFilters';
import { useScrollState } from '@template/ui/hooks/useScrollState';
import { useRef } from 'react';

export type UseInfiniteDataOptions<TItem> = {
  config: DataConfig;
  queryKey: QueryKey;
  /**
   * Fetch function for a single page. Receives the page param and
   * the current filter query (search/filter/sort params serialized
   * for the server). Merge filterQuery into your fetch call.
   */
  queryFn: (pageParam: number, filterQuery: Record<string, unknown>) => Promise<InfiniteDataPage<TItem>>;
  enabled?: boolean;
  /** Identifies this data view for scroll restore and section hash. */
  sectionId?: string;
  /** Restore scroll position on back/forward navigation. Default true when sectionId is set. */
  scrollRestore?: boolean;
};

export type InfiniteData<TItem> = DataFilters & {
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
  /** Props to spread onto Table's infiniteScroll prop. */
  infiniteScrollProps: InfiniteScrollProps;
  /** Props to spread onto Table or any layout container: { sectionId, scrollRef }. */
  layoutProps: {
    sectionId: string | undefined;
    scrollRef: React.RefObject<HTMLDivElement | null>;
  };
  /** The sectionId passed in options, for manual wiring. */
  sectionId: string | undefined;
  /** Ref for the scroll container, for manual wiring. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * Search, filter, sort, and infinite scroll pagination for server-side data.
 *
 * Combines useDataFilters (search/filter/sort) with useInfiniteDataQuery
 * (TanStack Query infinite pagination). When filters change, the query key
 * changes, causing TanStack Query to refetch from page 0.
 *
 * Works with any renderer — Table, card grids, feeds.
 *
 * Usage:
 * ```tsx
 * const feed = useInfiniteData({
 *   config: makeDataConfig('activityReadMany'),
 *   queryKey: ['activity'],
 *   queryFn: (page, filterQuery) => fetchActivity({ ...filterQuery, cursor: page }),
 *   sectionId: 'activityFeed',
 * });
 *
 * <Table
 *   columns={columns}
 *   data={feed.data}
 *   keyExtractor={(a) => a.id}
 *   infiniteScroll={feed.infiniteScrollProps}
 *   {...feed.layoutProps}
 * />
 * ```
 */
export function useInfiniteData<TItem>(
  options: UseInfiniteDataOptions<TItem>,
): InfiniteData<TItem> {
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
    scrollRef: shouldRestoreScroll ? scrollRef : undefined,
    ready: !query.isLoading,
  });

  const infiniteScrollProps: InfiniteScrollProps = {
    onLoadMore: query.fetchNextPage,
    hasMore: query.hasNextPage,
    isLoading: query.isFetchingNextPage,
  };

  const layoutProps = { sectionId, scrollRef };

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

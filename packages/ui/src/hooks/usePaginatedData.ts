/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import type { PaginationProps } from '@template/ui/components/primitives/Pagination';
import { type DataFilters, useDataFilters } from '@template/ui/hooks/useDataFilters';
import { useDebouncedCallback } from '@template/ui/hooks/useDebounce';
import { useScrollState } from '@template/ui/hooks/useScrollState';
import {
  parseOrderByStrings,
  readInitialState,
  writeToHistoryState,
  writeToHistoryStateAndUrl,
} from '@template/ui/lib/dataStatePersistence';
import type { DataConfig } from '@template/ui/lib/makeDataConfig';
import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type PaginatedData = DataFilters & {
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  reset: () => void;
  query: Record<string, unknown>;
  paginationProps: (total: number, pageSizeOptions?: number[]) => PaginationProps;
  layoutProps: {
    sectionId: string | undefined;
    scrollRef: React.RefObject<HTMLDivElement | null>;
  };
  sectionId: string | undefined;
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

export type UsePaginatedDataOptions = {
  config: DataConfig;
  sectionId?: string;
  shareableUrl?: boolean;
  scrollRestore?: boolean;
  defaultPageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

export const usePaginatedData = (options: UsePaginatedDataOptions): PaginatedData => {
  const { config, sectionId, shareableUrl = false, scrollRestore, defaultPageSize: defaultPageSizeOption } = options;

  const defaultPageSize = defaultPageSizeOption ?? DEFAULT_PAGE_SIZE;
  const shouldRestoreScroll = scrollRestore ?? sectionId != null;

  const stateKey = sectionId ? `data:${sectionId}` : undefined;
  const initialState = readInitialState(stateKey, shareableUrl);

  const [page, setPageRaw] = useState(initialState.page ?? 1);
  const [pageSize, setPageSizeRaw] = useState(initialState.pageSize ?? defaultPageSize);

  const initialOrderBy = initialState.orderBy ? parseOrderByStrings(initialState.orderBy) : undefined;

  const dataFilters = useDataFilters(config, () => setPageRaw(1), {
    search: initialState.search,
    orderBy: initialOrderBy,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollState({
    id: sectionId ?? 'default',
    scrollRef,
    ready: true,
    enabled: shouldRestoreScroll,
  });

  // Persist state to history.state (and optionally URL) on changes.
  const currentState = useMemo(
    () => ({
      page,
      pageSize,
      search: dataFilters.search,
      orderBy: dataFilters.orderBy.map(({ field, direction }) => `${field}:${direction}`),
    }),
    [page, pageSize, dataFilters.search, dataFilters.orderBy],
  );

  // Debounced write of page/search/sort to history.state (and optionally URL) whenever any persisted
  // field changes. currentState is the dep so the debounce restarts on every change; stateKey is a dep
  // so a remounted table with a different sectionId writes to the right slot.
  const writeState = useDebouncedCallback((key: string | undefined, state: typeof currentState, toUrl: boolean) => {
    if (toUrl) {
      writeToHistoryStateAndUrl(key, state);
    } else if (key) {
      writeToHistoryState(key, state);
    }
  }, DEBOUNCE_MS);

  useEffect(() => {
    writeState(stateKey, currentState, shareableUrl);
  }, [shareableUrl, stateKey, currentState, writeState]);

  const setPage = (p: number) => setPageRaw(p);

  const setPageSize = (s: number) => {
    setPageSizeRaw(s);
    setPageRaw(1);
  };

  const reset = () => {
    dataFilters.reset();
    setPageRaw(1);
    setPageSizeRaw(defaultPageSize);
  };

  const query = useMemo(
    () => ({ ...dataFilters.filterQuery, page, pageSize }),
    [dataFilters.filterQuery, page, pageSize],
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

  const layoutProps = useMemo(() => ({ sectionId, scrollRef }), [sectionId]);

  return {
    ...dataFilters,
    page,
    pageSize,
    setPage,
    setPageSize,
    reset,
    query,
    paginationProps,
    layoutProps,
    sectionId,
    scrollRef,
  };
};

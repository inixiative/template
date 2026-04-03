import type { DataConfig } from '@template/ui/lib/makeDataConfig';
import type { PaginationProps } from '@template/ui/components/primitives/Pagination';
import {
  type PersistedState,
  parseOrderByStrings,
  readInitialState,
  syncStateToUrl,
  writeToHistoryState,
  writeToHistoryStateAndUrl,
} from '@template/ui/lib/dataStatePersistence';
import { type DataFilters, useDataFilters } from '@template/ui/hooks/useDataFilters';
import { useScrollState } from '@template/ui/hooks/useScrollState';
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

/**
 * Search, filter, sort, and page-number pagination for server-side data.
 *
 * Works with any renderer — Table, card grids, lists.
 *
 * Usage:
 * ```tsx
 * const data = usePaginatedData({
 *   config: makeDataConfig('adminOrganizationReadMany'),
 *   sectionId: 'orgs',
 * });
 * const { data: response } = useQuery(queries.orgs.list(data.query));
 *
 * <Table
 *   columns={columns}
 *   data={response.items}
 *   keyExtractor={(o) => o.id}
 *   pagination={data.paginationProps(response.total)}
 *   {...data.layoutProps}
 * />
 * ```
 */
export const usePaginatedData = (options: UsePaginatedDataOptions): PaginatedData => {
  const {
    config,
    sectionId,
    shareableUrl = false,
    scrollRestore,
    defaultPageSize: defaultPageSizeOption,
  } = options;

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

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef(currentState);
  stateRef.current = currentState;
  const stateKeyRef = useRef(stateKey);
  stateKeyRef.current = stateKey;

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const current = stateRef.current;
      const key = stateKeyRef.current;

      if (shareableUrl) {
        writeToHistoryStateAndUrl(key, current);
      } else if (key) {
        writeToHistoryState(key, current);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [currentState, shareableUrl]);

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

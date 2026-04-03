import type { DataConfig } from '@template/ui/lib/makeDataConfig';
import type { PaginationProps } from '@template/ui/components/primitives/Pagination';
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
  /** Full query object with page, pageSize, and filter/sort params. */
  query: Record<string, unknown>;
  /**
   * Produces PaginationProps ready to spread into <Table pagination={...} />.
   * Pass the total record count from your query response.
   */
  paginationProps: (total: number, pageSizeOptions?: number[]) => PaginationProps;
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

export type UsePaginatedDataOptions = {
  config: DataConfig;
  /** Identifies this data view for scroll restore and section hash. */
  sectionId?: string;
  /** Persist page/filter state to URL search params for sharing. Default false. */
  shareableUrl?: boolean;
  /** Restore scroll position on back/forward navigation. Default true when sectionId is set. */
  scrollRestore?: boolean;
  defaultPageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;

/**
 * Search, filter, sort, and page-number pagination for server-side data.
 *
 * Works with any renderer — Table, card grids, lists. Not coupled to
 * a specific presentation component.
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

  // Read initial state from history.state (back/forward) or URL (shared link).
  const stateKey = sectionId ? `data:${sectionId}` : undefined;
  const initialState = readInitialState(stateKey, shareableUrl);

  const [page, setPageRaw] = useState(initialState.page ?? 1);
  const [pageSize, setPageSizeRaw] = useState(initialState.pageSize ?? defaultPageSize);

  const dataFilters = useDataFilters(config, () => setPageRaw(1));

  // Scroll restoration.
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
  usePersistState(stateKey, currentState, shareableUrl);

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

// --- State persistence helpers ---

type PersistedState = {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string[];
};

/** URL param names for each state field. */
const URL_PARAMS: Record<keyof PersistedState, string> = {
  page: 'page',
  pageSize: 'pageSize',
  search: 'search',
  orderBy: 'orderBy',
};

/** Sync a PersistedState to URL search params. Falsy/default values are removed. */
function syncStateToUrl(state: PersistedState): string {
  const url = new URL(window.location.href);

  for (const [key, param] of Object.entries(URL_PARAMS)) {
    const value = state[key as keyof PersistedState];

    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      url.searchParams.delete(param);
    } else if (key === 'page' && value === 1) {
      // Page 1 is the default — no need to pollute the URL.
      url.searchParams.delete(param);
    } else if (Array.isArray(value)) {
      url.searchParams.delete(param);
      for (const v of value) url.searchParams.append(param, v);
    } else {
      url.searchParams.set(param, String(value));
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

/** Read PersistedState from URL search params. */
function readStateFromUrl(): PersistedState {
  const params = new URLSearchParams(window.location.search);
  const state: PersistedState = {};

  const page = params.get('page');
  if (page) state.page = Number.parseInt(page, 10);

  const pageSize = params.get('pageSize');
  if (pageSize) state.pageSize = Number.parseInt(pageSize, 10);

  const search = params.get('search');
  if (search) state.search = search;

  const orderBy = params.getAll('orderBy');
  if (orderBy.length > 0) state.orderBy = orderBy;

  return state;
}

/** Read initial state from history.state, falling back to URL params. */
function readInitialState(stateKey: string | undefined, checkUrl: boolean): PersistedState {
  if (typeof window === 'undefined') return {};

  // Try history.state first (back/forward navigation).
  if (stateKey) {
    try {
      const saved = window.history.state?.[stateKey];
      if (saved && typeof saved === 'object') {
        return saved as PersistedState;
      }
    } catch {
      // SSR or sandboxed iframe
    }
  }

  // Fall back to URL params (shared link).
  if (checkUrl) {
    const fromUrl = readStateFromUrl();
    if (Object.keys(fromUrl).length > 0) return fromUrl;
  }

  return {};
}

const DEBOUNCE_MS = 300;

/** Write state to history.state under the given key. */
function writeToHistoryState(key: string, state: PersistedState): void {
  try {
    const historyState = { ...window.history.state, [key]: state };
    window.history.replaceState(historyState, '');
  } catch {
    // sandboxed iframe or SecurityError
  }
}

/** Write state to both history.state and URL search params. */
function writeToHistoryStateAndUrl(key: string | undefined, state: PersistedState): void {
  try {
    const url = syncStateToUrl(state);
    const historyState = key
      ? { ...window.history.state, [key]: state }
      : window.history.state;
    window.history.replaceState(historyState, '', url);
  } catch {
    // sandboxed iframe or SecurityError
  }
}

/** Persist state on changes, debounced. Writes to history.state always; URL params when shareableUrl. */
function usePersistState(
  stateKey: string | undefined,
  state: PersistedState,
  shareableUrl: boolean,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;
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
  }, [state, shareableUrl]);
}

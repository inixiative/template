import type { DataConfig } from '@template/ui/lib/makeDataConfig';
import type { PaginationProps } from '@template/ui/components/primitives/Pagination';
import { type DataFilters, useDataFilters } from '@template/ui/hooks/useDataFilters';
import { useScrollState } from '@template/ui/hooks/useScrollState';
import { useMemo, useRef, useState } from 'react';

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
    scrollRef: shouldRestoreScroll ? scrollRef : undefined,
    ready: true,
  });

  // Persist state to history.state (and optionally URL) on changes.
  const currentState = useMemo(
    () => ({ page, pageSize, search: dataFilters.search }),
    [page, pageSize, dataFilters.search],
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

  const layoutProps = { sectionId, scrollRef };

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
};

/** Read initial state from history.state, falling back to URL params. */
function readInitialState(stateKey: string | undefined, checkUrl: boolean): PersistedState {
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
  if (checkUrl && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const state: PersistedState = {};
    const page = params.get('page');
    const pageSize = params.get('pageSize');
    const search = params.get('search');
    if (page) state.page = Number.parseInt(page, 10);
    if (pageSize) state.pageSize = Number.parseInt(pageSize, 10);
    if (search) state.search = search;
    if (Object.keys(state).length > 0) return state;
  }

  return {};
}

const DEBOUNCE_MS = 300;

/** Persist state to history.state (always) and URL params (when shareableUrl). */
function usePersistState(
  stateKey: string | undefined,
  state: PersistedState,
  shareableUrl: boolean,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Use a ref for current state so the debounce callback reads fresh values.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Debounced persistence.
  const stateKeyRef = useRef(stateKey);
  stateKeyRef.current = stateKey;

  // biome-ignore lint/correctness/useExhaustiveDependencies: debounce triggers on state changes
  useMemo(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const current = stateRef.current;
      const key = stateKeyRef.current;

      // Always write to history.state.
      if (key) {
        try {
          const historyState = { ...window.history.state, [key]: current };
          window.history.replaceState(
            historyState,
            '',
            shareableUrl ? buildShareableUrl(current) : undefined,
          );
        } catch {
          // skip
        }
      } else if (shareableUrl) {
        try {
          window.history.replaceState(window.history.state, '', buildShareableUrl(current));
        } catch {
          // skip
        }
      }
    }, DEBOUNCE_MS);
  }, [state, shareableUrl]);
}

/** Build a URL string with table params merged into the current URL. */
function buildShareableUrl(state: PersistedState): string {
  const url = new URL(window.location.href);
  if (state.page && state.page > 1) url.searchParams.set('page', String(state.page));
  else url.searchParams.delete('page');
  if (state.pageSize) url.searchParams.set('pageSize', String(state.pageSize));
  else url.searchParams.delete('pageSize');
  if (state.search) url.searchParams.set('search', String(state.search));
  else url.searchParams.delete('search');
  return `${url.pathname}${url.search}${url.hash}`;
}

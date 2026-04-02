import * as React from 'react';

const DEBOUNCE_MS = 150;

export type ScrollState = {
  /** Top visible item index at time of navigation. */
  index: number;
  /** Number of loaded pages at time of navigation. */
  pageCount: number;
};

export type UseVirtualScrollStateOptions = {
  /**
   * Unique identifier for this scroll container. Used as the key in
   * history.state for per-element scroll tracking.
   */
  id: string;
  /** Current number of items (data.length). */
  itemCount: number;
  /** Current number of loaded pages from useVirtualTableQuery. */
  pageCount: number;
};

export type UseVirtualScrollStateResult = {
  /**
   * The index to restore to, or undefined if no restoration should happen.
   * Undefined when: fresh navigation, cache evicted (itemCount too low),
   * or no saved state exists.
   */
  initialIndex: number | undefined;
  /**
   * The saved page count from the previous navigation, or 0 if none.
   * Consumers can compare this against the current pageCount to determine
   * if the query cache still has all the data that was loaded before.
   */
  savedPageCount: number;
  /**
   * Whether the saved state could not be restored because the cache
   * doesn't cover the saved index. Consumers can use this to skip
   * any other restoration (e.g. pixel-based) and start fresh.
   */
  cacheInvalid: boolean;
  /**
   * Call this when the top visible index changes (from useVirtualListCore's
   * topVisibleIndex). Debounces writes to history.state.
   *
   * Writes are suppressed until the initial restore completes (or is
   * skipped), preventing a race where a transient `index: 0` overwrites
   * the saved restore target.
   */
  onTopIndexChange: (index: number) => void;
};

/**
 * Bridges navigation state with virtualized scroll containers.
 *
 * Reads/writes per-element scroll state (index + pageCount) to
 * history.state so that:
 * - Back/forward navigation restores the scroll index (if cache is warm)
 * - Fresh navigation (link click) starts from the top
 * - Multiple scroll containers on one page each track independently
 *
 * This hook owns scroll restoration entirely via index-based
 * `scrollToIndex`. It does NOT use TanStack Router's pixel-based
 * scroll restoration, because pixel offsets are inaccurate when
 * the virtualizer uses estimated sizes.
 *
 * The saved `pageCount` lets consumers know how many pages were loaded
 * at the time of navigation. If the query cache has fewer pages, the
 * cache has been partially evicted and restoration may be unreliable.
 *
 * Usage:
 * ```tsx
 * const scrollState = useVirtualScrollState({
 *   id: 'users-table',
 *   itemCount: query.data.length,
 *   pageCount: query.pageCount,
 * });
 *
 * const { topVisibleIndex, ... } = useVirtualListCore({
 *   initialIndex: scrollState.initialIndex,
 *   ...
 * });
 *
 * useEffect(() => {
 *   scrollState.onTopIndexChange(topVisibleIndex);
 * }, [topVisibleIndex, scrollState.onTopIndexChange]);
 * ```
 */
export function useVirtualScrollState(
  options: UseVirtualScrollStateOptions,
): UseVirtualScrollStateResult {
  const { id, itemCount, pageCount } = options;

  const stateKey = `vscroll:${id}`;

  // Read saved state once on mount.
  const savedRef = React.useRef<ScrollState | null>(null);
  const initializedRef = React.useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    try {
      const raw = window.history.state?.[stateKey];
      if (raw && typeof raw === 'object' && typeof raw.index === 'number') {
        savedRef.current = raw as ScrollState;
      }
    } catch {
      // sandboxed iframe or SSR
    }
  }

  // Determine if we can restore.
  const saved = savedRef.current;
  const cacheCoversIndex = saved !== null && itemCount > saved.index;
  const cacheInvalid = saved !== null && !cacheCoversIndex;
  const initialIndex = cacheCoversIndex ? saved.index : undefined;
  const savedPageCount = saved?.pageCount ?? 0;

  // When cache is invalid, clear the stale entry from history.state
  // so subsequent navigations don't try to restore a dead position.
  const clearedRef = React.useRef(false);
  React.useEffect(() => {
    if (!cacheInvalid || clearedRef.current) return;
    clearedRef.current = true;
    savedRef.current = null;
    try {
      const { [stateKey]: _, ...rest } = window.history.state ?? {};
      window.history.replaceState(rest, '');
    } catch {
      // skip
    }
  }, [cacheInvalid, stateKey]);

  // Suppress writes until restore completes (or is skipped).
  // This prevents a transient `index: 0` from overwriting the saved target.
  const restoreCompleteRef = React.useRef(saved === null);
  React.useEffect(() => {
    if (restoreCompleteRef.current) return;
    // Restore was skipped (cache invalid) or completed (initialIndex consumed).
    if (cacheInvalid || cacheCoversIndex) {
      restoreCompleteRef.current = true;
    }
  }, [cacheInvalid, cacheCoversIndex]);

  // Persist scroll state to history.state (debounced).
  // pageCount is read via ref to avoid stale closures in the debounce timer.
  const pageCountRef = React.useRef(pageCount);
  pageCountRef.current = pageCount;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastIndexRef = React.useRef<number | null>(null);

  const onTopIndexChange = React.useCallback(
    (index: number) => {
      if (index < 0 || index === lastIndexRef.current || !restoreCompleteRef.current) return;
      lastIndexRef.current = index;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          const state: ScrollState = { index, pageCount: pageCountRef.current };
          const historyState = { ...window.history.state, [stateKey]: state };
          window.history.replaceState(historyState, '');
        } catch {
          // skip
        }
      }, DEBOUNCE_MS);
    },
    [stateKey],
  );

  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return {
    initialIndex,
    savedPageCount,
    cacheInvalid,
    onTopIndexChange,
  };
}

import { useElementScrollRestoration } from '@tanstack/react-router';
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
   * router location state and as the data-scroll-restoration-id.
   */
  id: string;
  /** Current number of loaded pages from useVirtualTableQuery. */
  pageCount: number;
  /** Current number of items (data.length). */
  itemCount: number;
};

export type UseVirtualScrollStateResult = {
  /**
   * The index to restore to, or undefined if no restoration should happen.
   * Undefined when: fresh navigation, cache evicted (itemCount too low),
   * or no saved state exists.
   */
  initialIndex: number | undefined;
  /**
   * Ref callback — set as the scroll container's ref. Registers it
   * for the router's element scroll restoration and provides the
   * data-scroll-restoration-id attribute.
   */
  scrollRestorationId: string;
  /**
   * Whether the router's pixel-based scroll restoration should be
   * suppressed for this element. True when cache was evicted (saved
   * index exceeds current itemCount), meaning pixel restore would
   * overshoot into empty space.
   */
  suppressPixelRestore: boolean;
  /**
   * Call this when the top visible index changes (from useVirtualListCore's
   * topVisibleIndex). Debounces writes to history.state.
   */
  onTopIndexChange: (index: number) => void;
};

/**
 * Bridges TanStack Router navigation state with virtualized scroll containers.
 *
 * Reads/writes per-element scroll state to history.state so that:
 * - Back/forward navigation restores the scroll index (if cache is warm)
 * - Fresh navigation (link click) starts from the top
 * - Multiple scroll containers on one page each track independently
 *
 * Usage:
 * ```tsx
 * const scrollState = useVirtualScrollState({
 *   id: 'users-table',
 *   pageCount: query.pageCount,
 *   itemCount: query.data.length,
 * });
 *
 * const { virtualizer, topVisibleIndex, ... } = useVirtualListCore({
 *   initialIndex: scrollState.initialIndex,
 *   ...
 * });
 *
 * // Persist scroll position on scroll
 * useEffect(() => {
 *   scrollState.onTopIndexChange(topVisibleIndex);
 * }, [topVisibleIndex, scrollState.onTopIndexChange]);
 *
 * // On the scroll container div:
 * <div data-scroll-restoration-id={scrollState.scrollRestorationId} ... />
 * ```
 */
export function useVirtualScrollState(
  options: UseVirtualScrollStateOptions,
): UseVirtualScrollStateResult {
  const { id, pageCount, itemCount } = options;

  const stateKey = `vscroll:${id}`;
  const scrollRestorationId = id;

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

  // Use the router's element scroll restoration to read the saved pixel entry.
  // When we suppress pixel restore, consumers should ignore the entry.
  const _scrollEntry = useElementScrollRestoration({ id: scrollRestorationId });

  // Determine if we can restore.
  const saved = savedRef.current;
  const cacheCoversIndex = saved !== null && itemCount > saved.index;
  const suppressPixelRestore = saved !== null && !cacheCoversIndex;
  const initialIndex = cacheCoversIndex ? saved.index : undefined;

  // Persist scroll state to history.state (debounced).
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastIndexRef = React.useRef<number | null>(null);

  const onTopIndexChange = React.useCallback(
    (index: number) => {
      if (index < 0 || index === lastIndexRef.current) return;
      lastIndexRef.current = index;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          const state: ScrollState = { index, pageCount };
          const historyState = { ...window.history.state, [stateKey]: state };
          window.history.replaceState(historyState, '');
        } catch {
          // skip
        }
      }, DEBOUNCE_MS);
    },
    [stateKey, pageCount],
  );

  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return {
    initialIndex,
    scrollRestorationId,
    suppressPixelRestore,
    onTopIndexChange,
  };
}

import { type ScrollToOptions, useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

const INDEX_DEBOUNCE_MS = 200;

export type VirtualListCoreOptions = {
  itemCount: number;
  scrollRef: React.RefObject<HTMLElement | null>;
  estimateSize: number;
  horizontal?: boolean;
  overscan?: number;
  /**
   * Unique key for this virtual list instance. When set, the top visible
   * index is persisted to `history.state` so that browser back/forward
   * navigation restores the scroll position. Fresh navigations (e.g. link
   * clicks) start from the top because the history entry has no saved index.
   */
  scrollStateKey?: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  loadMoreThreshold?: number;
};

export type VirtualListCoreResult = {
  virtualizer: Virtualizer<HTMLElement, Element>;
  virtualItems: ReturnType<Virtualizer<HTMLElement, Element>['getVirtualItems']>;
};

export type VirtualListHandle = {
  scrollToIndex: (index: number, options?: ScrollToOptions) => void;
};

export function useVirtualListCore(options: VirtualListCoreOptions): VirtualListCoreResult {
  const {
    itemCount,
    scrollRef,
    estimateSize,
    horizontal = false,
    overscan = 5,
    scrollStateKey,
    onLoadMore,
    isLoadingMore,
    hasMore,
    loadMoreThreshold = 5,
  } = options;

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    horizontal,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Restore top visible index from history.state on back/forward navigation.
  // Fresh navigations have no saved index, so the list starts at the top.
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (!scrollStateKey || restoredRef.current || itemCount === 0) return;
    restoredRef.current = true;
    try {
      const saved = window.history.state?.[scrollStateKey];
      if (typeof saved === 'number' && saved < itemCount) {
        virtualizer.scrollToIndex(saved, { align: 'start' });
      }
    } catch {
      // history.state access can throw in sandboxed iframes
    }
  }, [scrollStateKey, itemCount, virtualizer]);

  // Persist top visible index to history.state (debounced).
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPersistedRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!scrollStateKey || !restoredRef.current) return;
    const firstItem = virtualItems[0];
    if (!firstItem || firstItem.index === lastPersistedRef.current) return;
    lastPersistedRef.current = firstItem.index;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const state = { ...window.history.state, [scrollStateKey]: firstItem.index };
        window.history.replaceState(state, '');
      } catch {
        // skip
      }
    }, INDEX_DEBOUNCE_MS);
  }, [scrollStateKey, virtualItems]);

  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  // Infinite load trigger
  React.useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= itemCount - loadMoreThreshold) {
      onLoadMore();
    }
  }, [virtualItems, itemCount, loadMoreThreshold, onLoadMore, hasMore, isLoadingMore]);

  return { virtualizer, virtualItems };
}

/**
 * Build an imperative handle for scrollToIndex/scrollToItem.
 * Used by both VirtualTable and VirtualScroll via useImperativeHandle.
 */
export function buildScrollHandle<T>(
  virtualizer: Virtualizer<HTMLElement, Element>,
  items: T[],
  keyExtractor: (item: T) => string,
): VirtualListHandle & { scrollToItem: (key: string) => boolean } {
  return {
    scrollToIndex: (index, options) => virtualizer.scrollToIndex(index, options),
    scrollToItem: (key) => {
      const index = items.findIndex((item) => keyExtractor(item) === key);
      if (index === -1) return false;
      virtualizer.scrollToIndex(index, { align: 'start' });
      return true;
    },
  };
}

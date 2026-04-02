import { type ScrollToOptions, useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

/**
 * Scroll mode determines where the scroll container lives:
 * - `viewport`: A fixed-height div with overflow (scrolls inside a window on the page).
 * - `window`: The browser window itself (items expand the page, page scrollbar scrolls).
 */
export type ScrollMode = 'viewport' | 'window';

export type VirtualListCoreOptions = {
  itemCount: number;
  /**
   * Ref to the scroll container element. Required for `viewport` mode.
   * Ignored in `window` mode (uses document.documentElement automatically).
   */
  scrollRef: React.RefObject<HTMLElement | null>;
  estimateSize: number;
  horizontal?: boolean;
  overscan?: number;
  /**
   * `viewport` (default): scrolls inside a fixed-height container.
   * `window`: items expand the page; the browser scrollbar is the scroll container.
   */
  scrollMode?: ScrollMode;
  /**
   * When set, the virtualizer scrolls to this index on mount (once itemCount
   * covers it). Consumers typically read this from router location state.
   */
  initialIndex?: number;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  loadMoreThreshold?: number;
};

export type VirtualListCoreResult = {
  virtualizer: Virtualizer<HTMLElement, Element>;
  virtualItems: ReturnType<Virtualizer<HTMLElement, Element>['getVirtualItems']>;
  /** Index of the topmost visible item. -1 when no items are rendered. */
  topVisibleIndex: number;
  /** Padding before the first rendered item (px). Use as paddingTop or paddingLeft. */
  paddingStart: number;
  /** Padding after the last rendered item (px). Use as paddingBottom or paddingRight. */
  paddingEnd: number;
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
    scrollMode = 'viewport',
    initialIndex,
    onLoadMore,
    isLoadingMore,
    hasMore,
    loadMoreThreshold = 5,
  } = options;

  const getScrollElement = React.useCallback(() => {
    if (scrollMode === 'window') {
      return typeof document !== 'undefined' ? document.documentElement : null;
    }
    return scrollRef.current;
  }, [scrollMode, scrollRef]);

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement,
    estimateSize: () => estimateSize,
    horizontal,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Padding for the flow-based layout approach. Items render in normal
  // flow with padding before/after to maintain correct scroll height.
  const paddingStart = virtualItems[0]?.start ?? 0;
  const paddingEnd =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const topVisibleIndex = virtualItems[0]?.index ?? -1;

  // Restore to initialIndex once data covers it. Uses scrollToIndex's
  // built-in reconciliation loop to converge on the correct position
  // as real measurements arrive across frames.
  const restoredRef = React.useRef(false);
  const virtualizerRef = React.useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  React.useEffect(() => {
    // Index 0 is the default position — no scroll action needed, just mark restored.
    if (restoredRef.current || initialIndex == null) return;
    if (initialIndex === 0) {
      restoredRef.current = true;
      return;
    }
    if (itemCount > initialIndex) {
      restoredRef.current = true;
      virtualizerRef.current.scrollToIndex(initialIndex, { align: 'start' });
    }
  }, [initialIndex, itemCount]);

  // Infinite load trigger — uses derived index to avoid re-running on every render.
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;
  React.useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    if (lastVisibleIndex < 0) return;
    if (lastVisibleIndex >= itemCount - loadMoreThreshold) {
      onLoadMore();
    }
  }, [lastVisibleIndex, itemCount, loadMoreThreshold, onLoadMore, hasMore, isLoadingMore]);

  return { virtualizer, virtualItems, topVisibleIndex, paddingStart, paddingEnd };
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

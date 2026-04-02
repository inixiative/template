import { type ScrollToOptions, useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

export type VirtualListCoreOptions = {
  itemCount: number;
  scrollRef: React.RefObject<HTMLElement | null>;
  estimateSize: number;
  horizontal?: boolean;
  overscan?: number;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  loadMoreThreshold?: number;
};

export type VirtualListCoreResult = {
  virtualizer: Virtualizer<HTMLElement, Element>;
  virtualItems: ReturnType<Virtualizer<HTMLElement, Element>['getVirtualItems']>;
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

  // Compute padding for the flow-based layout approach.
  // Items render in normal flow with padding before/after to maintain
  // correct scroll height without absolute positioning.
  const paddingStart = virtualItems[0]?.start ?? 0;
  const paddingEnd =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  // Infinite load trigger — use derived index to avoid re-running on every render.
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;
  React.useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    if (lastVisibleIndex < 0) return;
    if (lastVisibleIndex >= itemCount - loadMoreThreshold) {
      onLoadMore();
    }
  }, [lastVisibleIndex, itemCount, loadMoreThreshold, onLoadMore, hasMore, isLoadingMore]);

  return { virtualizer, virtualItems, paddingStart, paddingEnd };
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

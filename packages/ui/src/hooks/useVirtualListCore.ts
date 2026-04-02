import { type ScrollToOptions, useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useIndexRestore } from '@template/ui/hooks/useScrollRestore';
import * as React from 'react';

export type VirtualListCoreOptions = {
  itemCount: number;
  scrollRef: React.RefObject<HTMLElement | null>;
  estimateSize: number;
  horizontal?: boolean;
  overscan?: number;
  restoreScrollKey?: string;
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
    restoreScrollKey,
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

  // Stable scrollToIndex reference for useIndexRestore
  const scrollToIndexFn = React.useCallback(
    (index: number) => virtualizer.scrollToIndex(index, { align: 'start' }),
    [virtualizer],
  );

  const { onVisibleIndexChange } = useIndexRestore(restoreScrollKey, itemCount, scrollToIndexFn);

  const virtualItems = virtualizer.getVirtualItems();

  // Persist top visible item index (with change guard inside onVisibleIndexChange)
  React.useEffect(() => {
    const firstItem = virtualItems[0];
    if (firstItem) {
      onVisibleIndexChange(firstItem.index);
    }
  }, [virtualItems, onVisibleIndexChange]);

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

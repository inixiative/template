import {
  type ScrollToOptions,
  useVirtualizer,
  useWindowVirtualizer,
  type Virtualizer,
} from '@tanstack/react-virtual';
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
   * Ref to the scroll container element. Used in `viewport` mode as the
   * scroll container. In `window` mode, used only to compute `scrollMargin`
   * (the offset between the page top and the list container).
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
  virtualizer: Virtualizer<HTMLElement, Element> | Virtualizer<Window, Element>;
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

// Shared post-virtualizer logic (padding, initial restore, infinite scroll).
function useVirtualListEffects(
  virtualizer: Virtualizer<HTMLElement, Element> | Virtualizer<Window, Element>,
  options: VirtualListCoreOptions,
): Omit<VirtualListCoreResult, 'virtualizer'> {
  const { itemCount, initialIndex, onLoadMore, isLoadingMore, hasMore, loadMoreThreshold = 5 } = options;

  const virtualItems = virtualizer.getVirtualItems();

  // In window mode, item start/end values include scrollMargin.
  // Subtract it so padding reflects only the virtual content offset.
  const margin = virtualizer.options.scrollMargin ?? 0;
  const paddingStart = Math.max(0, (virtualItems[0]?.start ?? 0) - margin);
  const paddingEnd =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const topVisibleIndex = virtualItems[0]?.index ?? -1;

  // Restore to initialIndex once data covers it.
  const restoredRef = React.useRef(false);
  const virtualizerRef = React.useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  React.useEffect(() => {
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

  // Infinite load trigger.
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;
  React.useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    if (lastVisibleIndex < 0) return;
    if (lastVisibleIndex >= itemCount - loadMoreThreshold) {
      onLoadMore();
    }
  }, [lastVisibleIndex, itemCount, loadMoreThreshold, onLoadMore, hasMore, isLoadingMore]);

  return { virtualItems, topVisibleIndex, paddingStart, paddingEnd };
}

/**
 * Viewport-mode virtualizer: scrolls inside a fixed-height container.
 */
function useViewportVirtualList(options: VirtualListCoreOptions): VirtualListCoreResult {
  const { itemCount, scrollRef, estimateSize, horizontal = false, overscan = 5 } = options;

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    horizontal,
    overscan,
  });

  const effects = useVirtualListEffects(virtualizer, options);
  return { virtualizer, ...effects };
}

/**
 * Window-mode virtualizer: items expand the page, browser scrollbar scrolls.
 * Uses `scrollMargin` to account for content above the list container.
 */
function useWindowVirtualList(options: VirtualListCoreOptions): VirtualListCoreResult {
  const { itemCount, scrollRef, estimateSize, horizontal = false, overscan = 5 } = options;

  // Compute scrollMargin from the container's position on the page.
  // This tells the virtualizer how far from the scroll origin the list starts.
  const [scrollMargin, setScrollMargin] = React.useState(0);
  // useLayoutEffect so margin is computed before the browser paints,
  // avoiding a frame of wrong item positions.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateMargin = () => {
      const rect = el.getBoundingClientRect();
      const margin = horizontal
        ? rect.left + window.scrollX
        : rect.top + window.scrollY;
      setScrollMargin(margin);
    };
    updateMargin();
    // Recalculate on resize in case layout shifts.
    const observer = new ResizeObserver(updateMargin);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRef, horizontal]);

  const virtualizer = useWindowVirtualizer({
    count: itemCount,
    estimateSize: () => estimateSize,
    horizontal,
    overscan,
    scrollMargin,
  });

  const effects = useVirtualListEffects(virtualizer, options);
  return { virtualizer, ...effects };
}

/**
 * Entry point — selects viewport or window virtualizer based on scrollMode.
 * Consumers should NOT change scrollMode after mount (unmount/remount instead).
 */
export function useVirtualListCore(options: VirtualListCoreOptions): VirtualListCoreResult {
  const { scrollMode = 'viewport' } = options;

  // Guard: scrollMode must not change after mount (different hooks would execute).
  const initialScrollMode = React.useRef(scrollMode);
  if (process.env.NODE_ENV !== 'production' && initialScrollMode.current !== scrollMode) {
    throw new Error(
      'useVirtualListCore: scrollMode must not change after mount. ' +
      'Use key={scrollMode} on the component to force a remount.',
    );
  }

  if (scrollMode === 'window') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useWindowVirtualList(options);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useViewportVirtualList(options);
}

/**
 * Build an imperative handle for scrollToIndex/scrollToItem.
 * Used by both VirtualTable and VirtualScroll via useImperativeHandle.
 */
export function buildScrollHandle<T>(
  virtualizer: Virtualizer<HTMLElement, Element> | Virtualizer<Window, Element>,
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

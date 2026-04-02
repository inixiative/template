import { type ScrollToOptions, useVirtualizer } from '@tanstack/react-virtual';
import { useIndexRestore } from '@template/ui/hooks/useScrollRestore';
import { cn } from '@template/ui/lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

export type VirtualScrollHandle = {
  /** Scroll to a specific item index. */
  scrollToIndex: (index: number, options?: ScrollToOptions) => void;
  /** Scroll to an item by key. Returns false if item not found. */
  scrollToItem: (key: string) => boolean;
};

export type VirtualScrollProps<T> = {
  items: T[];
  keyExtractor: (item: T) => string;
  /** Render function for each item. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Estimated item height in pixels. Defaults to 100. */
  estimateItemHeight?: number;
  /** Max height of the scrollable container. Defaults to 600. */
  maxHeight?: number;
  /** Called when the user scrolls near the bottom. */
  onLoadMore?: () => void;
  /** Whether more data is currently being fetched. */
  isLoadingMore?: boolean;
  /** Whether there are more items to load. */
  hasMore?: boolean;
  /** Number of items from the bottom to trigger onLoadMore. Defaults to 5. */
  loadMoreThreshold?: number;
  /** Layout direction. Defaults to 'vertical'. */
  direction?: 'vertical' | 'horizontal';
  /** Number of items to render beyond the visible area. Defaults to 5. */
  overscan?: number;
  show?: boolean | (() => boolean);
  /**
   * When set, persists the top visible item index to sessionStorage
   * and restores it on mount. Stable across nested scroll containers.
   */
  restoreScrollKey?: string;
  className?: string;
  /** Optional empty state message or element. */
  emptyMessage?: React.ReactNode;
};

export const VirtualScroll = React.forwardRef<VirtualScrollHandle, VirtualScrollProps<unknown>>(
  (
    {
      items,
      keyExtractor,
      renderItem,
      estimateItemHeight = 100,
      maxHeight = 600,
      onLoadMore,
      isLoadingMore,
      hasMore,
      loadMoreThreshold = 5,
      direction = 'vertical',
      overscan = 5,
      show = true,
      restoreScrollKey,
      className,
      emptyMessage,
    },
    ref,
  ) => {
    const shouldShow = typeof show === 'function' ? show() : show;
    if (!shouldShow) return null;

    if (items.length === 0 && emptyMessage) {
      return <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>;
    }

    return (
      <VirtualScrollInner
        ref={ref}
        items={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        estimateItemHeight={estimateItemHeight}
        maxHeight={maxHeight}
        onLoadMore={onLoadMore}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        loadMoreThreshold={loadMoreThreshold}
        direction={direction}
        overscan={overscan}
        restoreScrollKey={restoreScrollKey}
        className={className}
      />
    );
  },
) as <T>(props: VirtualScrollProps<T> & { ref?: React.Ref<VirtualScrollHandle> }) => React.ReactElement | null;

type InnerProps<T> = Omit<VirtualScrollProps<T>, 'show' | 'emptyMessage'>;

const VirtualScrollInner = React.forwardRef<VirtualScrollHandle, InnerProps<unknown>>(
  (
    {
      items,
      keyExtractor,
      renderItem,
      estimateItemHeight = 100,
      maxHeight = 600,
      onLoadMore,
      isLoadingMore,
      hasMore,
      loadMoreThreshold = 5,
      direction = 'vertical',
      overscan = 5,
      restoreScrollKey,
      className,
    },
    ref,
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const isHorizontal = direction === 'horizontal';
    const { savedIndex, markRestored, persistIndex } = useIndexRestore(restoreScrollKey);

    const virtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => estimateItemHeight,
      horizontal: isHorizontal,
      overscan,
    });

    // Restore saved index once data is ready
    const restoredRef = React.useRef(false);
    React.useEffect(() => {
      if (restoredRef.current || items.length === 0 || savedIndex === null) {
        if (items.length > 0 && savedIndex === null) markRestored();
        return;
      }
      if (savedIndex < items.length) {
        restoredRef.current = true;
        virtualizer.scrollToIndex(savedIndex, { align: 'start' });
        markRestored();
      }
    }, [items.length, savedIndex, virtualizer, markRestored]);

    const virtualItems = virtualizer.getVirtualItems();

    // Persist top visible item index
    React.useEffect(() => {
      const firstItem = virtualItems[0];
      if (firstItem) {
        persistIndex(firstItem.index);
      }
    }, [virtualItems, persistIndex]);

    // Infinite load trigger
    React.useEffect(() => {
      if (!onLoadMore || !hasMore || isLoadingMore) return;
      const lastItem = virtualItems[virtualItems.length - 1];
      if (!lastItem) return;
      if (lastItem.index >= items.length - loadMoreThreshold) {
        onLoadMore();
      }
    }, [virtualItems, items.length, loadMoreThreshold, onLoadMore, hasMore, isLoadingMore]);

    // Expose imperative handle
    React.useImperativeHandle(ref, () => ({
      scrollToIndex: (index, options) => {
        virtualizer.scrollToIndex(index, options);
      },
      scrollToItem: (key) => {
        const index = items.findIndex((item) => keyExtractor(item) === key);
        if (index === -1) return false;
        virtualizer.scrollToIndex(index, { align: 'start' });
        return true;
      },
    }));

    return (
      <div
        ref={scrollRef}
        className={cn('overflow-auto', className)}
        style={isHorizontal ? { maxWidth: maxHeight, overflowX: 'auto' } : { maxHeight, overflowY: 'auto' }}
      >
        <div
          style={
            isHorizontal
              ? { width: virtualizer.getTotalSize(), height: '100%', position: 'relative' }
              : { height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }
          }
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            return (
              <div
                key={keyExtractor(item)}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={
                  isHorizontal
                    ? {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        transform: `translateX(${virtualItem.start}px)`,
                      }
                    : {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }
                }
              >
                {renderItem(item, virtualItem.index)}
              </div>
            );
          })}
        </div>
        {isLoadingMore && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading more...</span>
          </div>
        )}
      </div>
    );
  },
) as <T>(props: InnerProps<T> & { ref?: React.Ref<VirtualScrollHandle> }) => React.ReactElement;

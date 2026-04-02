import { useVirtualizer } from '@tanstack/react-virtual';
import { useScrollRestore } from '@template/ui/hooks/useScrollRestore';
import { cn } from '@template/ui/lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

export type VirtualScrollProps<T> = {
  items: T[];
  keyExtractor: (item: T) => string;
  /** Render function for each item. Receives item, index, and whether it's being measured. */
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
  /** When set, persists and restores scroll position across refreshes via sessionStorage. */
  restoreScrollKey?: string;
  className?: string;
  /** Optional empty state message or element. */
  emptyMessage?: React.ReactNode;
};

export const VirtualScroll = <T,>({
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
}: VirtualScrollProps<T>) => {
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  if (items.length === 0 && emptyMessage) {
    return <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <VirtualScrollInner
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
};

function VirtualScrollInner<T>({
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
}: Omit<VirtualScrollProps<T>, 'show' | 'emptyMessage'>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useScrollRestore(scrollRef, restoreScrollKey);
  const isHorizontal = direction === 'horizontal';

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateItemHeight,
    horizontal: isHorizontal,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  React.useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= items.length - loadMoreThreshold) {
      onLoadMore();
    }
  }, [virtualItems, items.length, loadMoreThreshold, onLoadMore, hasMore, isLoadingMore]);

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
}

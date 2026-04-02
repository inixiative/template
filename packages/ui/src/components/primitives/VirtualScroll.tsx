import type { ScrollToOptions } from '@tanstack/react-virtual';
import { buildScrollHandle, useVirtualListCore } from '@template/ui/hooks/useVirtualListCore';
import { cn } from '@template/ui/lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

export type VirtualScrollHandle = {
  scrollToIndex: (index: number, options?: ScrollToOptions) => void;
  scrollToItem: (key: string) => boolean;
};

export type VirtualScrollProps<T> = {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateItemHeight?: number;
  maxHeight?: number;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  loadMoreThreshold?: number;
  direction?: 'vertical' | 'horizontal';
  overscan?: number;
  show?: boolean | (() => boolean);
  restoreScrollKey?: string;
  className?: string;
  emptyMessage?: React.ReactNode;
};

export const VirtualScroll = React.forwardRef<VirtualScrollHandle, VirtualScrollProps<unknown>>(
  ({ show = true, emptyMessage, items, ...rest }, ref) => {
    const shouldShow = typeof show === 'function' ? show() : show;
    if (!shouldShow) return null;

    if (items.length === 0 && emptyMessage) {
      return <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>;
    }

    return <VirtualScrollInner ref={ref} items={items} {...rest} />;
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

    const { virtualizer, virtualItems } = useVirtualListCore({
      itemCount: items.length,
      scrollRef,
      estimateSize: estimateItemHeight,
      horizontal: isHorizontal,
      overscan,
      restoreScrollKey,
      onLoadMore,
      isLoadingMore,
      hasMore,
      loadMoreThreshold,
    });

    React.useImperativeHandle(ref, () => buildScrollHandle(virtualizer, items, keyExtractor), [
      virtualizer,
      items,
      keyExtractor,
    ]);

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

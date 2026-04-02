import type { ScrollToOptions } from '@tanstack/react-virtual';
import { buildScrollHandle, useVirtualListCore } from '@template/ui/hooks/useVirtualListCore';
import { cn } from '@template/ui/lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

export type VirtualScrollHandle = {
  scrollToIndex: (index: number, options?: ScrollToOptions) => void;
  scrollToItem: (key: string) => boolean;
};

/**
 * Virtualized vertical scroll list with infinite-load support.
 *
 * Horizontal / carousel layout
 * ────────────────────────────
 * This component intentionally only supports vertical scrolling.
 * For a horizontal infinite carousel, build a dedicated component that:
 *  1. Wraps useVirtualListCore with `horizontal: true`.
 *  2. Adds carousel UX affordances (prev/next buttons, snap-to-item,
 *     page indicators, keyboard arrow navigation).
 *  3. Manages its own scroll-snap CSS (`scroll-snap-type: x mandatory`
 *     on the container, `scroll-snap-align: start` on items).
 *  4. Optionally integrates with onLoadMore for infinite content.
 * useVirtualListCore already accepts a `horizontal` flag, so the
 * virtualization layer is ready — only the presentation is missing.
 */
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
  overscan?: number;
  show?: boolean | (() => boolean);
  /** Key for history.state scroll index persistence (back/forward nav only). */
  scrollStateKey?: string;
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
      overscan = 5,
      scrollStateKey,
      className,
    },
    ref,
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const { virtualizer, virtualItems } = useVirtualListCore({
      itemCount: items.length,
      scrollRef,
      estimateSize: estimateItemHeight,
      overscan,
      scrollStateKey,
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
        style={{ maxHeight, overflowY: 'auto' }}
      >
        <div
          style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            return (
              <div
                key={keyExtractor(item)}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
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

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
 * Items render in normal document flow (no absolute positioning) using
 * padding to maintain correct scroll height. This ensures consistent
 * measurement and compatibility with standard CSS (borders, flex, etc.).
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
  /** Index to scroll to on mount (e.g. from useVirtualScrollState). */
  initialIndex?: number;
  show?: boolean | (() => boolean);
  className?: string;
  emptyMessage?: React.ReactNode;
  /** Set to use with useVirtualScrollState for router-driven restoration. */
  scrollRestorationId?: string;
  /** Called when the top visible index changes. Wire to useVirtualScrollState. */
  onTopIndexChange?: (index: number) => void;
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
      initialIndex,
      className,
      scrollRestorationId,
      onTopIndexChange,
    },
    ref,
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const { virtualizer, virtualItems, topVisibleIndex, paddingStart, paddingEnd } = useVirtualListCore({
      itemCount: items.length,
      scrollRef,
      estimateSize: estimateItemHeight,
      overscan,
      initialIndex,
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

    // Notify parent of scroll position changes.
    React.useEffect(() => {
      onTopIndexChange?.(topVisibleIndex);
    }, [topVisibleIndex, onTopIndexChange]);

    return (
      <div
        ref={scrollRef}
        className={cn('overflow-auto', className)}
        style={{ maxHeight, overflowY: 'auto' }}
        data-scroll-restoration-id={scrollRestorationId}
      >
        <div style={{ paddingTop: paddingStart, paddingBottom: paddingEnd }}>
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            return (
              <div
                key={keyExtractor(item)}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
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

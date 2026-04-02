import type { ScrollToOptions } from '@tanstack/react-virtual';
import type { ScrollMode } from '@template/ui/hooks/useVirtualListCore';
import { useVirtualListCore } from '@template/ui/hooks/useVirtualListCore';
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
 * Supports two scroll modes:
 * - `viewport` (default): Scrolls inside a fixed-height container.
 *   Use when the list lives in a panel, modal, or sidebar.
 * - `window`: Items expand the page; the browser scrollbar scrolls.
 *   Use for full-page lists (feeds, search results, etc.).
 *
 * Items render in normal document flow (no absolute positioning) using
 * padding to maintain correct scroll height.
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
  /**
   * Max height of the scroll container. Only applies in `viewport` mode.
   * Ignored in `window` mode (the page expands naturally).
   */
  maxHeight?: number;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  loadMoreThreshold?: number;
  overscan?: number;
  /**
   * `viewport` (default): fixed-height scrollable container.
   * `window`: items expand the page, browser scrollbar scrolls.
   */
  scrollMode?: ScrollMode;
  /** Index to scroll to on mount (e.g. from useVirtualScrollState). */
  initialIndex?: number;
  show?: boolean | (() => boolean);
  className?: string;
  emptyMessage?: React.ReactNode;
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
      scrollMode = 'viewport',
      initialIndex,
      className,
      onTopIndexChange,
    },
    ref,
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const isWindow = scrollMode === 'window';

    const { virtualizer, virtualItems, topVisibleIndex, paddingStart, paddingEnd } = useVirtualListCore({
      itemCount: items.length,
      scrollRef,
      estimateSize: estimateItemHeight,
      overscan,
      scrollMode,
      initialIndex,
      onLoadMore,
      isLoadingMore,
      hasMore,
      loadMoreThreshold,
    });

    const virtualizerRef = React.useRef(virtualizer);
    virtualizerRef.current = virtualizer;
    const itemsRef = React.useRef(items);
    itemsRef.current = items;

    React.useImperativeHandle(ref, () => ({
      scrollToIndex: (index, options) => virtualizerRef.current.scrollToIndex(index, options),
      scrollToItem: (key) => {
        const idx = itemsRef.current.findIndex((item) => keyExtractor(item) === key);
        if (idx === -1) return false;
        virtualizerRef.current.scrollToIndex(idx, { align: 'start' });
        return true;
      },
    }), [keyExtractor]);

    // Notify parent of scroll position changes.
    React.useEffect(() => {
      onTopIndexChange?.(topVisibleIndex);
    }, [topVisibleIndex, onTopIndexChange]);

    const content = (
      <>
        <div style={{ paddingTop: paddingStart, paddingBottom: paddingEnd }}>
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            if (!item) return null;
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
      </>
    );

    if (isWindow) {
      // Window mode: no scroll container, items expand the page.
      // scrollRef is still set for measurement but the actual scroll
      // element is document.documentElement (handled by useVirtualListCore).
      return (
        <div ref={scrollRef} className={className}>
          {content}
        </div>
      );
    }

    return (
      <div
        ref={scrollRef}
        className={cn('overflow-auto', className)}
        style={{ maxHeight, overflowY: 'auto' }}
      >
        {content}
      </div>
    );
  },
) as <T>(props: InnerProps<T> & { ref?: React.Ref<VirtualScrollHandle> }) => React.ReactElement;

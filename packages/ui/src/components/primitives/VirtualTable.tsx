import type { ScrollToOptions } from '@tanstack/react-virtual';
import type { Column } from '@template/ui/components/primitives/Table';
import type { ScrollMode } from '@template/ui/hooks/useVirtualListCore';
import { useVirtualListCore } from '@template/ui/hooks/useVirtualListCore';
import { cn } from '@template/ui/lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

export type VirtualTableHandle = {
  scrollToRow: (index: number, options?: ScrollToOptions) => void;
  scrollToItem: (key: string) => boolean;
};

export type VirtualTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  show?: boolean | (() => boolean);
  estimateRowHeight?: number;
  /**
   * Max height of the scroll container. Only applies in `viewport` mode.
   * Ignored in `window` mode (the page expands naturally).
   */
  maxHeight?: number;
  overscan?: number;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  loadMoreThreshold?: number;
  /**
   * `viewport` (default): fixed-height scrollable container with sticky header.
   * `window`: table expands the page, browser scrollbar scrolls.
   *   Note: sticky header still works in window mode (sticks to viewport top).
   */
  scrollMode?: ScrollMode;
  /** Index to scroll to on mount (e.g. from useVirtualScrollState). */
  initialIndex?: number;
  className?: string;
  /** Called when the top visible index changes. Wire to useVirtualScrollState. */
  onTopIndexChange?: (index: number) => void;
};

export const VirtualTable = React.forwardRef<VirtualTableHandle, VirtualTableProps<unknown>>(
  ({ show = true, emptyMessage, data, ...rest }, ref) => {
    const shouldShow = typeof show === 'function' ? show() : show;
    if (!shouldShow) return null;

    if (data.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">{emptyMessage || 'No data available'}</div>;
    }

    return <VirtualTableInner ref={ref} data={data} {...rest} />;
  },
) as <T>(props: VirtualTableProps<T> & { ref?: React.Ref<VirtualTableHandle> }) => React.ReactElement | null;

type InnerProps<T> = Omit<VirtualTableProps<T>, 'show' | 'emptyMessage'>;

const VirtualTableInner = React.forwardRef<VirtualTableHandle, InnerProps<unknown>>(
  (
    {
      columns,
      data,
      keyExtractor,
      onRowClick,
      estimateRowHeight = 48,
      maxHeight = 600,
      overscan = 10,
      onLoadMore,
      isLoadingMore,
      hasMore,
      loadMoreThreshold = 5,
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
      itemCount: data.length,
      scrollRef,
      estimateSize: estimateRowHeight,
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
    const dataRef = React.useRef(data);
    dataRef.current = data;

    React.useImperativeHandle(ref, () => ({
      scrollToRow: (index, options) => virtualizerRef.current.scrollToIndex(index, options),
      scrollToItem: (key) => {
        const idx = dataRef.current.findIndex((item) => keyExtractor(item) === key);
        if (idx === -1) return false;
        virtualizerRef.current.scrollToIndex(idx, { align: 'start' });
        return true;
      },
    }), [keyExtractor]);

    // Notify parent of scroll position changes.
    React.useEffect(() => {
      onTopIndexChange?.(topVisibleIndex);
    }, [topVisibleIndex, onTopIndexChange]);

    const tableContent = (
      <table className="w-full" style={{ tableLayout: 'fixed' }}>
        <thead className="bg-muted border-b sticky top-0 z-10">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paddingStart > 0 && (
            <tr aria-hidden="true">
              <td colSpan={columns.length} style={{ height: paddingStart, padding: 0, border: 'none' }} />
            </tr>
          )}
          {virtualItems.map((virtualRow) => {
            const item = data[virtualRow.index];
            if (!item) return null;
            return (
              <tr
                key={keyExtractor(item)}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={cn('border-b hover:bg-muted/30 transition-colors', onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-sm">
                    {column.render
                      ? column.render(item)
                      : ((item as Record<string, unknown>)[column.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingEnd > 0 && (
            <tr aria-hidden="true">
              <td colSpan={columns.length} style={{ height: paddingEnd, padding: 0, border: 'none' }} />
            </tr>
          )}
        </tbody>
      </table>
    );

    const loader = isLoadingMore && (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading more...</span>
      </div>
    );

    if (isWindow) {
      return (
        <div ref={scrollRef} className={cn('border rounded-lg overflow-hidden', className)}>
          {tableContent}
          {loader}
        </div>
      );
    }

    return (
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        <div ref={scrollRef} style={{ maxHeight, overflow: 'auto' }}>
          {tableContent}
          {loader}
        </div>
      </div>
    );
  },
) as <T>(props: InnerProps<T> & { ref?: React.Ref<VirtualTableHandle> }) => React.ReactElement;

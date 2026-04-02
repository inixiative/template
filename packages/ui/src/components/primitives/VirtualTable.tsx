import { type ScrollToOptions, useVirtualizer } from '@tanstack/react-virtual';
import type { Column } from '@template/ui/components/primitives/Table';
import { useIndexRestore } from '@template/ui/hooks/useScrollRestore';
import { cn } from '@template/ui/lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

export type VirtualTableHandle = {
  /** Scroll to a specific row index. */
  scrollToRow: (index: number, options?: ScrollToOptions) => void;
  /** Scroll to an item by key. Returns false if item not found. */
  scrollToItem: (key: string) => boolean;
};

export type VirtualTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  show?: boolean | (() => boolean);
  /** Estimated row height in pixels. Defaults to 48. */
  estimateRowHeight?: number;
  /** Max height of the scrollable area. Defaults to 600. */
  maxHeight?: number;
  /** Called when the user scrolls near the bottom. Use to fetch more data. */
  onLoadMore?: () => void;
  /** Whether more data is currently being fetched. */
  isLoadingMore?: boolean;
  /** Whether there are more pages to load. */
  hasMore?: boolean;
  /** Number of rows from the bottom to trigger onLoadMore. Defaults to 5. */
  loadMoreThreshold?: number;
  /**
   * When set, persists the top visible row index to sessionStorage
   * and restores it on mount. Stable across nested scroll containers.
   */
  restoreScrollKey?: string;
  className?: string;
};

export const VirtualTable = React.forwardRef<VirtualTableHandle, VirtualTableProps<unknown>>(
  (
    {
      columns,
      data,
      keyExtractor,
      onRowClick,
      emptyMessage,
      show = true,
      estimateRowHeight = 48,
      maxHeight = 600,
      onLoadMore,
      isLoadingMore,
      hasMore,
      loadMoreThreshold = 5,
      restoreScrollKey,
      className,
    },
    ref,
  ) => {
    const shouldShow = typeof show === 'function' ? show() : show;
    if (!shouldShow) return null;

    if (data.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">{emptyMessage || 'No data available'}</div>;
    }

    return (
      <VirtualTableInner
        ref={ref}
        columns={columns}
        data={data}
        keyExtractor={keyExtractor}
        onRowClick={onRowClick}
        estimateRowHeight={estimateRowHeight}
        maxHeight={maxHeight}
        onLoadMore={onLoadMore}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        loadMoreThreshold={loadMoreThreshold}
        restoreScrollKey={restoreScrollKey}
        className={className}
      />
    );
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
      onLoadMore,
      isLoadingMore,
      hasMore,
      loadMoreThreshold = 5,
      restoreScrollKey,
      className,
    },
    ref,
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const { savedIndex, markRestored, persistIndex } = useIndexRestore(restoreScrollKey);

    const virtualizer = useVirtualizer({
      count: data.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => estimateRowHeight,
      overscan: 10,
    });

    // Restore saved index once data is ready
    const restoredRef = React.useRef(false);
    React.useEffect(() => {
      if (restoredRef.current || data.length === 0 || savedIndex === null) {
        if (data.length > 0 && savedIndex === null) markRestored();
        return;
      }
      if (savedIndex < data.length) {
        restoredRef.current = true;
        virtualizer.scrollToIndex(savedIndex, { align: 'start' });
        markRestored();
      }
    }, [data.length, savedIndex, virtualizer, markRestored]);

    const virtualRows = virtualizer.getVirtualItems();

    // Persist top visible row index on scroll
    React.useEffect(() => {
      const firstItem = virtualRows[0];
      if (firstItem) {
        persistIndex(firstItem.index);
      }
    }, [virtualRows, persistIndex]);

    // Infinite load trigger
    React.useEffect(() => {
      if (!onLoadMore || !hasMore || isLoadingMore) return;
      const lastItem = virtualRows[virtualRows.length - 1];
      if (!lastItem) return;
      if (lastItem.index >= data.length - loadMoreThreshold) {
        onLoadMore();
      }
    }, [virtualRows, data.length, loadMoreThreshold, onLoadMore, hasMore, isLoadingMore]);

    // Expose imperative handle
    React.useImperativeHandle(ref, () => ({
      scrollToRow: (index, options) => {
        virtualizer.scrollToIndex(index, options);
      },
      scrollToItem: (key) => {
        const index = data.findIndex((item) => keyExtractor(item) === key);
        if (index === -1) return false;
        virtualizer.scrollToIndex(index, { align: 'start' });
        return true;
      },
    }));

    return (
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        <div ref={scrollRef} style={{ maxHeight, overflow: 'auto' }}>
          <table className="w-full">
            <thead className="bg-muted/50 border-b sticky top-0 z-10">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y relative" style={{ height: virtualizer.getTotalSize() }}>
              {virtualRows.map((virtualRow) => {
                const item = data[virtualRow.index];
                return (
                  <tr
                    key={keyExtractor(item)}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className={cn('hover:bg-muted/30 transition-colors', onRowClick && 'cursor-pointer')}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
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
            </tbody>
          </table>
          {isLoadingMore && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Loading more...</span>
            </div>
          )}
        </div>
      </div>
    );
  },
) as <T>(props: InnerProps<T> & { ref?: React.Ref<VirtualTableHandle> }) => React.ReactElement;

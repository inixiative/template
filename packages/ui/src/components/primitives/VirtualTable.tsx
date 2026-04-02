import { useVirtualizer } from '@tanstack/react-virtual';
import type { Column } from '@template/ui/components/primitives/Table';
import { useScrollRestore } from '@template/ui/hooks/useScrollRestore';
import { cn } from '@template/ui/lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

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
  /** When set, persists and restores scroll position across refreshes via sessionStorage. */
  restoreScrollKey?: string;
  className?: string;
};

export const VirtualTable = <T,>({
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
}: VirtualTableProps<T>) => {
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  if (data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">{emptyMessage || 'No data available'}</div>;
  }

  return (
    <VirtualTableInner
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
};

/**
 * Inner component that always renders hooks unconditionally.
 * Separated from the outer component to respect rules of hooks
 * while still supporting the `show` and empty-state early returns.
 */
function VirtualTableInner<T>({
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
}: Omit<VirtualTableProps<T>, 'show' | 'emptyMessage'>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useScrollRestore(scrollRef, restoreScrollKey);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();

  React.useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    const lastItem = virtualRows[virtualRows.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= data.length - loadMoreThreshold) {
      onLoadMore();
    }
  }, [virtualRows, data.length, loadMoreThreshold, onLoadMore, hasMore, isLoadingMore]);

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
}

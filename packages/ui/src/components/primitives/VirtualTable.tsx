import type { ScrollToOptions } from '@tanstack/react-virtual';
import type { Column } from '@template/ui/components/primitives/Table';
import { buildScrollHandle, useVirtualListCore } from '@template/ui/hooks/useVirtualListCore';
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
  maxHeight?: number;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  loadMoreThreshold?: number;
  restoreScrollKey?: string;
  className?: string;
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

    const { virtualizer, virtualItems } = useVirtualListCore({
      itemCount: data.length,
      scrollRef,
      estimateSize: estimateRowHeight,
      overscan: 10,
      restoreScrollKey,
      onLoadMore,
      isLoadingMore,
      hasMore,
      loadMoreThreshold,
    });

    React.useImperativeHandle(ref, () => {
      const handle = buildScrollHandle(virtualizer, data, keyExtractor);
      return { scrollToRow: handle.scrollToIndex, scrollToItem: handle.scrollToItem };
    }, [virtualizer, data, keyExtractor]);

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
              {virtualItems.map((virtualRow) => {
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

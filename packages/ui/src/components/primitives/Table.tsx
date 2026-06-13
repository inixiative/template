/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { Pagination, type PaginationProps } from '@template/ui/components/primitives/Pagination';
import { useInfiniteScrollTrigger } from '@template/ui/hooks/useInfiniteScrollTrigger';
import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';

export type Column<T> = {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
};

export type InfiniteScrollProps = {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  rootMargin?: string;
};

const noop = () => {};

export type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  show?: boolean | (() => boolean);
  pagination?: PaginationProps;
  infiniteScroll?: InfiniteScrollProps;
  maxHeight?: number;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  sectionId?: string;
  className?: string;
};

export const Table = <T,>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage,
  show = true,
  pagination,
  infiniteScroll,
  maxHeight,
  scrollRef,
  sectionId,
  className,
}: TableProps<T>) => {
  // Hooks must be called unconditionally, before any early returns.
  const sentinelRef = useInfiniteScrollTrigger({
    onLoadMore: infiniteScroll?.onLoadMore ?? noop,
    hasMore: infiniteScroll?.hasMore ?? false,
    isLoading: infiniteScroll?.isLoading ?? false,
    rootMargin: infiniteScroll?.rootMargin,
  });

  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  if (data.length === 0 && !infiniteScroll?.isLoading) {
    return <div className="text-center py-8 text-muted-foreground">{emptyMessage || 'No data available'}</div>;
  }

  const isViewport = maxHeight != null;

  return (
    <div className={cn('space-y-4', className)} data-section={sectionId}>
      <div
        ref={isViewport ? scrollRef : undefined}
        className="border rounded-lg overflow-hidden"
        style={isViewport ? { maxHeight, overflow: 'auto' } : undefined}
      >
        <table className="w-full" style={isViewport ? { tableLayout: 'fixed' } : undefined}>
          <thead className={cn('bg-muted border-b', isViewport && 'sticky top-0 z-10')}>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                data-key={keyExtractor(item)}
                className={cn('hover:bg-muted/30 transition-colors', onRowClick && 'cursor-pointer')}
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
            ))}
          </tbody>
        </table>

        {/* Infinite scroll sentinel + loading indicator */}
        {infiniteScroll && (
          <>
            <div ref={sentinelRef} aria-hidden="true" />
            {infiniteScroll.isLoading && (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Icon icon="lucide:loader2" className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Loading more...</span>
              </div>
            )}
          </>
        )}
      </div>

      {pagination && <Pagination {...pagination} />}
    </div>
  );
};

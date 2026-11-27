/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { EmptyState, type EmptyStateProps } from '@template/ui/components/primitives/EmptyState';
import { loadingMaskAttributes } from '@template/ui/components/primitives/loadingMaskAttributes';
import { Pagination, type PaginationProps } from '@template/ui/components/primitives/Pagination';
import { TablePlaceholderRows } from '@template/ui/components/primitives/TablePlaceholderRows';
import { useInfiniteScrollTrigger } from '@template/ui/hooks/useInfiniteScrollTrigger';
import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';

export type Column<T> = {
  key: string;
  label: React.ReactNode;
  render?: (item: T) => React.ReactNode;
  // The cell's shape when it is more than one line of text (a badge, a button): drawn while loading,
  // and kept invisibly under every loaded cell so rows are the same height either way.
  placeholder?: React.ReactNode;
};

export type InfiniteScrollProps = {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  rootMargin?: string;
};

const noop = () => {};

const CellKeepingPlaceholderShape = ({
  placeholder,
  children,
}: {
  placeholder: React.ReactNode;
  children: React.ReactNode;
}) =>
  placeholder === undefined ? (
    children
  ) : (
    <div className="grid items-center [&>*]:col-start-1 [&>*]:row-start-1">
      <div aria-hidden="true" inert className="invisible">
        {placeholder}
      </div>
      <div>{children}</div>
    </div>
  );

export type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  empty?: Omit<EmptyStateProps, 'show' | 'className' | 'title'> & { title?: string };
  show?: boolean | (() => boolean);
  pagination?: PaginationProps;
  infiniteScroll?: InfiniteScrollProps;
  maxHeight?: number;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  sectionId?: string;
  className?: string;
  isLoading?: boolean;
};

export const Table = <T,>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage,
  empty,
  show = true,
  pagination,
  infiniteScroll,
  maxHeight,
  scrollRef,
  sectionId,
  className,
  isLoading = false,
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

  if (!isLoading && data.length === 0 && !infiniteScroll?.isLoading) {
    return (
      <EmptyState
        {...empty}
        title={empty?.title ?? emptyMessage ?? 'Nothing here yet'}
        className="rounded-xl border border-dashed bg-muted/30"
      />
    );
  }

  const isViewport = maxHeight != null;

  return (
    <div className={cn('space-y-4', className)} data-section={sectionId}>
      <div
        ref={isViewport ? scrollRef : undefined}
        className="border rounded-xl overflow-hidden bg-card"
        style={isViewport ? { maxHeight, overflow: 'auto' } : undefined}
      >
        <table className="w-full" style={isViewport ? { tableLayout: 'fixed' } : undefined}>
          <thead className={cn('bg-muted/60 border-b', isViewport && 'sticky top-0 z-10')}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" {...loadingMaskAttributes(isLoading)}>
            {isLoading && <TablePlaceholderRows columns={columns} rows={5} />}
            {!isLoading &&
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  data-key={keyExtractor(item)}
                  className={cn(
                    'transition-colors hover:bg-muted/40',
                    onRowClick && 'cursor-pointer',
                  )}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-sm">
                      <CellKeepingPlaceholderShape placeholder={column.placeholder}>
                        {column.render
                          ? column.render(item)
                          : ((item as Record<string, unknown>)[column.key] as React.ReactNode)}
                      </CellKeepingPlaceholderShape>
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
                <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin mr-2" />
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

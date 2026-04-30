import { Icon } from '@iconify/react';
import { Button } from '@template/ui/components/primitives/Button';
import { cn } from '@template/ui/lib/utils';

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Total number of records across all pages. */
  totalRecords?: number;
  /** Current page size. Required when pageSizeOptions is provided. */
  pageSize?: number;
  /** Available page size choices. Pass an empty array to hide the selector. */
  pageSizeOptions?: number[];
  /** Called when the user selects a different page size. */
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Build the page number buttons to display.
 * Shows first, last, current ± siblings, with ellipses for gaps.
 * e.g. [1, '...', 4, 5, 6, '...', 20]
 */
export function buildPageRange(currentPage: number, totalPages: number, siblings = 1): (number | '...')[] {
  if (totalPages <= 1) return [];

  const pages: (number | '...')[] = [];
  const rangeStart = Math.max(2, currentPage - siblings);
  const rangeEnd = Math.min(totalPages - 1, currentPage + siblings);

  // Always include page 1
  pages.push(1);

  // Ellipsis after page 1 if gap is more than one page
  if (rangeStart > 3) {
    pages.push('...');
  } else if (rangeStart === 3) {
    pages.push(2);
  }

  // Middle range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  // Ellipsis before last page if gap is more than one page
  if (rangeEnd < totalPages - 2) {
    pages.push('...');
  } else if (rangeEnd === totalPages - 2) {
    pages.push(totalPages - 1);
  }

  // Always include last page (if > 1)
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  totalRecords,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: PaginationProps) => {
  const showPageSizeSelector = pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange && pageSize;

  if (totalPages <= 1 && !totalRecords && !showPageSizeSelector) return null;

  const effectiveOptions = pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;

  // "Showing X-Y of Z results"
  const recordRange =
    totalRecords != null && pageSize != null
      ? {
          from: (currentPage - 1) * pageSize + 1,
          to: Math.min(currentPage * pageSize, totalRecords),
          total: totalRecords,
        }
      : null;

  const pages = buildPageRange(currentPage, totalPages);

  return (
    <div className={cn('flex items-center justify-between gap-4 text-sm', className)}>
      {/* Left: record count + page size selector */}
      <div className="flex items-center gap-4 text-muted-foreground">
        {recordRange && (
          <span>
            Showing {recordRange.from}–{recordRange.to} of {recordRange.total}
          </span>
        )}
        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <span>Rows</span>
            <select
              aria-label="Rows per page"
              className={cn(
                'h-8 rounded-md border border-input bg-background px-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {effectiveOptions.map((size) => (
                <option key={size} value={String(size)}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            <Icon icon="lucide:chevrons-left" className="h-4 w-4" />
          </Button>

          {/* Previous page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <Icon icon="lucide:chevron-left" className="h-4 w-4" />
          </Button>

          {/* Page numbers */}
          {pages.map((page, i) =>
            page === '...' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: ellipses have no identity beyond their slot in the rendered list.
              <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(page)}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </Button>
            ),
          )}

          {/* Next page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <Icon icon="lucide:chevron-right" className="h-4 w-4" />
          </Button>

          {/* Last page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Last page"
          >
            <Icon icon="lucide:chevrons-right" className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

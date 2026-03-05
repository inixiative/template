import { Button } from '@template/ui/components/primitives/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type Column<T> = {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
};

export type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  noDataMessage?: string;
  show?: boolean | (() => boolean);
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  paginationLabels?: {
    previous?: string;
    next?: string;
    pageSummary?: (currentPage: number, totalPages: number) => string;
  };
};

export const Table = <T,>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage,
  noDataMessage,
  show = true,
  pagination,
  paginationLabels,
}: TableProps<T>) => {
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  const resolvedEmptyMessage = emptyMessage ?? noDataMessage ?? '';
  const previousLabel = paginationLabels?.previous ?? 'Previous';
  const nextLabel = paginationLabels?.next ?? 'Next';
  const pageSummary =
    paginationLabels?.pageSummary ??
    ((currentPage: number, totalPages: number) => `Page ${currentPage} of ${totalPages}`);

  if (data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">{resolvedEmptyMessage}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
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
                className={`hover:bg-muted/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-sm">
                    {column.render ? column.render(item) : (item as Record<string, React.ReactNode>)[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {pageSummary(pagination.currentPage, pagination.totalPages)}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {previousLabel}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
            >
              {nextLabel}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

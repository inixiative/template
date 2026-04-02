import { Pagination, type PaginationProps } from '@template/ui/components/primitives/Pagination';

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
  show?: boolean | (() => boolean);
  pagination?: PaginationProps;
};

export const Table = <T,>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage,
  show = true,
  pagination,
}: TableProps<T>) => {
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  if (data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">{emptyMessage || 'No data available'}</div>;
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
                    {column.render
                      ? column.render(item)
                      : ((item as Record<string, unknown>)[column.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination {...pagination} />}
    </div>
  );
};

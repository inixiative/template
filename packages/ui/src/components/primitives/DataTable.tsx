import { Alert } from '@template/ui/components/primitives/Alert';
import { Button } from '@template/ui/components/primitives/Button';
import { Checkbox } from '@template/ui/components/primitives/Checkbox';
import { EmptyState } from '@template/ui/components/primitives/EmptyState';
import { Skeleton } from '@template/ui/components/primitives/Skeleton';
import { cn } from '@template/ui/lib/utils';
import * as React from 'react';

export type ColumnDef<T> = {
  id: string;
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  hidden?: boolean;
  className?: string;
};

type SortState = {
  column: string;
  direction: 'asc' | 'desc';
};

export type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  error?: string;
  emptyMessage?: string;
  totalCount?: number;
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  syncToUrl?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  bulkActions?: (selected: T[]) => React.ReactNode;
  columnVisibility?: boolean;
  onRowClick?: (row: T) => void;
  rowKey: keyof T | ((row: T) => string);
  noPermission?: boolean;
  labels?: {
    emptyTitle?: string;
    loadingTitle?: string;
    errorTitle?: string;
    noPermissionTitle?: string;
    noPermissionMessage?: string;
    previous?: string;
    next?: string;
    pageSummary?: (page: number, totalPages: number, totalCount: number) => string;
    columnsToggle?: string;
  };
  show?: boolean | (() => boolean);
};

const getValueByColumn = <T,>(row: T, column: ColumnDef<T>): unknown => {
  if (column.cell) return column.cell(row);
  if (column.accessorKey) return row[column.accessorKey];
  return undefined;
};

const compareValues = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b));
};

const getRowId = <T,>(row: T, rowKey: keyof T | ((row: T) => string)): string => {
  if (typeof rowKey === 'function') return rowKey(row);
  return String(row[rowKey]);
};

const parsePositiveInt = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
};

export const DataTable = <T,>({
  data,
  columns,
  isLoading = false,
  error,
  emptyMessage,
  totalCount,
  pageSize = 10,
  page = 1,
  onPageChange,
  sort,
  onSortChange,
  syncToUrl = false,
  selectable = false,
  onSelectionChange,
  bulkActions,
  columnVisibility = false,
  onRowClick,
  rowKey,
  noPermission = false,
  labels,
  show = true,
}: DataTableProps<T>) => {
  const shouldShow = typeof show === 'function' ? show() : show;
  const [internalPage, setInternalPage] = React.useState(page);
  const [internalSort, setInternalSort] = React.useState<SortState | undefined>(sort);
  const [selectedRowIds, setSelectedRowIds] = React.useState<Set<string>>(new Set());
  const [hiddenColumnIds, setHiddenColumnIds] = React.useState<Set<string>>(
    () => new Set(columns.filter((column) => column.hidden).map((column) => column.id)),
  );

  React.useEffect(() => {
    setInternalPage(page);
  }, [page]);

  React.useEffect(() => {
    setInternalSort(sort);
  }, [sort]);

  React.useEffect(() => {
    setHiddenColumnIds(new Set(columns.filter((column) => column.hidden).map((column) => column.id)));
  }, [columns]);

  const activeSort = sort ?? internalSort;
  const setSort = onSortChange ?? setInternalSort;
  const isServerPaginated = totalCount !== undefined || !!onPageChange;
  const activePage = onPageChange ? page : internalPage;
  const setPage = onPageChange ?? setInternalPage;

  React.useEffect(() => {
    if (!syncToUrl || typeof window === 'undefined') return;

    const search = new URLSearchParams(window.location.search);
    const queryPage = parsePositiveInt(search.get('page'));
    const querySortColumn = search.get('sortColumn');
    const querySortDirection = search.get('sortDirection');

    if (queryPage && queryPage !== activePage) {
      setPage(queryPage);
    }

    if (
      querySortColumn &&
      (querySortDirection === 'asc' || querySortDirection === 'desc') &&
      (!activeSort || activeSort.column !== querySortColumn || activeSort.direction !== querySortDirection)
    ) {
      setSort({
        column: querySortColumn,
        direction: querySortDirection,
      });
    }
  }, [activePage, activeSort, setPage, setSort, syncToUrl]);

  React.useEffect(() => {
    if (!syncToUrl || typeof window === 'undefined') return;

    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set('page', String(activePage));

    if (activeSort) {
      nextParams.set('sortColumn', activeSort.column);
      nextParams.set('sortDirection', activeSort.direction);
    } else {
      nextParams.delete('sortColumn');
      nextParams.delete('sortDirection');
    }

    const nextQuery = nextParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [activePage, activeSort, syncToUrl]);

  const filteredColumns = React.useMemo(() => {
    return columns.filter((column) => !hiddenColumnIds.has(column.id));
  }, [columns, hiddenColumnIds]);

  const sortedData = React.useMemo(() => {
    if (!activeSort || onSortChange) return data;

    const sortableColumn = columns.find((column) => column.id === activeSort.column);
    if (!sortableColumn) return data;

    const nextRows = [...data];
    nextRows.sort((rowA, rowB) => {
      const valueA = getValueByColumn(rowA, sortableColumn);
      const valueB = getValueByColumn(rowB, sortableColumn);
      const result = compareValues(valueA, valueB);
      return activeSort.direction === 'asc' ? result : -result;
    });
    return nextRows;
  }, [activeSort, columns, data, onSortChange]);

  const pagedData = React.useMemo(() => {
    if (isServerPaginated) return sortedData;
    const offset = (activePage - 1) * pageSize;
    return sortedData.slice(offset, offset + pageSize);
  }, [activePage, isServerPaginated, pageSize, sortedData]);

  const effectiveTotalCount = totalCount ?? sortedData.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotalCount / pageSize));

  React.useEffect(() => {
    if (activePage > totalPages) {
      setPage(totalPages);
    }
  }, [activePage, setPage, totalPages]);

  React.useEffect(() => {
    const visibleRowIds = new Set(data.map((row) => getRowId(row, rowKey)));
    setSelectedRowIds((previous) => {
      const next = new Set<string>();
      for (const id of previous) {
        if (visibleRowIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [data, rowKey]);

  const selectedRows = React.useMemo(() => {
    const selected = pagedData.filter((row) => selectedRowIds.has(getRowId(row, rowKey)));
    return selected;
  }, [pagedData, rowKey, selectedRowIds]);

  React.useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [onSelectionChange, selectedRows]);

  const allPageRowsSelected =
    pagedData.length > 0 && pagedData.every((row) => selectedRowIds.has(getRowId(row, rowKey)));
  const hasSelectedRows = selectedRows.length > 0;

  const emptyTitle = labels?.emptyTitle ?? '';
  const loadingTitle = labels?.loadingTitle ?? '';
  const errorTitle = labels?.errorTitle ?? '';
  const noPermissionTitle = labels?.noPermissionTitle ?? '';
  const noPermissionMessage = labels?.noPermissionMessage ?? '';
  const previousLabel = labels?.previous ?? 'Previous';
  const nextLabel = labels?.next ?? 'Next';
  const columnsToggleLabel = labels?.columnsToggle ?? 'Columns';
  const pageSummary =
    labels?.pageSummary ??
    ((currentPage: number, maxPage: number, count: number) => `Page ${currentPage} of ${maxPage} (${count})`);

  if (!shouldShow) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {loadingTitle && <p className="text-sm text-muted-foreground">{loadingTitle}</p>}
        <div className="rounded-lg border">
          <div className="space-y-2 p-4">
            <Skeleton count={Math.max(3, pageSize)} />
          </div>
        </div>
      </div>
    );
  }

  if (noPermission) {
    return <EmptyState title={noPermissionTitle} description={noPermissionMessage} />;
  }

  if (error) {
    return (
      <Alert tone="error" title={errorTitle}>
        {error}
      </Alert>
    );
  }

  if (pagedData.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      {(columnVisibility || (selectable && hasSelectedRows)) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>{selectable && hasSelectedRows && bulkActions?.(selectedRows)}</div>
          {columnVisibility && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{columnsToggleLabel}</span>
              <div className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1">
                {columns.map((column) => (
                  <div key={column.id} className="inline-flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={!hiddenColumnIds.has(column.id)}
                      onCheckedChange={(checked) => {
                        setHiddenColumnIds((previous) => {
                          const next = new Set(previous);
                          if (checked) {
                            next.delete(column.id);
                          } else {
                            next.add(column.id);
                          }
                          return next;
                        });
                      }}
                    />
                    <span>{column.header}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              {selectable && (
                <th className="w-12 px-3 py-2">
                  <Checkbox
                    checked={allPageRowsSelected}
                    onCheckedChange={(checked) => {
                      setSelectedRowIds((previous) => {
                        const next = new Set(previous);
                        for (const row of pagedData) {
                          const id = getRowId(row, rowKey);
                          if (checked) {
                            next.add(id);
                          } else {
                            next.delete(id);
                          }
                        }
                        return next;
                      });
                    }}
                  />
                </th>
              )}
              {filteredColumns.map((column) => {
                const isSorted = activeSort?.column === column.id;
                const sortDirection = isSorted ? activeSort?.direction : undefined;

                if (!column.sortable) {
                  return (
                    <th
                      key={column.id}
                      className={cn('px-4 py-3 text-left text-sm font-medium text-muted-foreground', column.className)}
                    >
                      {column.header}
                    </th>
                  );
                }

                return (
                  <th key={column.id} className={cn('px-4 py-3 text-left text-sm font-medium', column.className)}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const nextDirection: 'asc' | 'desc' = isSorted && sortDirection === 'asc' ? 'desc' : 'asc';
                        setSort({
                          column: column.id,
                          direction: nextDirection,
                        });
                      }}
                    >
                      <span>{column.header}</span>
                      {isSorted && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {pagedData.map((row) => {
              const rowId = getRowId(row, rowKey);
              return (
                <tr
                  key={rowId}
                  className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-muted/30')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selectedRowIds.has(rowId)}
                        onCheckedChange={(checked) => {
                          setSelectedRowIds((previous) => {
                            const next = new Set(previous);
                            if (checked) {
                              next.add(rowId);
                            } else {
                              next.delete(rowId);
                            }
                            return next;
                          });
                        }}
                      />
                    </td>
                  )}
                  {filteredColumns.map((column) => (
                    <td key={column.id} className={cn('px-4 py-3 text-sm', column.className)}>
                      {column.cell
                        ? column.cell(row)
                        : column.accessorKey
                          ? (row[column.accessorKey] as React.ReactNode)
                          : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{pageSummary(activePage, totalPages, effectiveTotalCount)}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, activePage - 1))}
              disabled={activePage <= 1}
            >
              {previousLabel}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, activePage + 1))}
              disabled={activePage >= totalPages}
            >
              {nextLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

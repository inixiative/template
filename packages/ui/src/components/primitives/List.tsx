/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Skeleton } from '@template/ui/components/primitives/Skeleton';
import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';

export type ListProps<T> = {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyMessage: string;
  isPending?: boolean;
  placeholderRows?: number;
  className?: string;
};

const placeholderWidths = ['40%', '55%', '30%'];

export const List = <T,>({
  items,
  renderItem,
  emptyMessage,
  isPending = false,
  placeholderRows = 3,
  className,
}: ListProps<T>) => {
  if (!isPending && items.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;

  return (
    <ul className={cn('divide-y rounded-md border', className)} aria-busy={isPending}>
      {isPending
        ? Array.from({ length: placeholderRows }, (_, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
            <li key={row} className="flex items-center justify-between gap-4 px-4 py-3">
              <Skeleton
                className="h-4"
                style={{ width: placeholderWidths[row % placeholderWidths.length] }}
              />
              <Skeleton className="h-4 w-16" />
            </li>
          ))
        : items.map(renderItem)}
    </ul>
  );
};

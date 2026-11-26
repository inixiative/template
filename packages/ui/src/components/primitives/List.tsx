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
  emptyMessage?: string;
  isLoading?: boolean;
  className?: string;
};

const placeholderWidths = ['40%', '55%', '30%'];

export const List = <T,>({
  items,
  renderItem,
  emptyMessage,
  isLoading = false,
  className,
}: ListProps<T>) => {
  if (!isLoading && items.length === 0)
    return emptyMessage ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null;

  return (
    <ul className={cn('divide-y rounded-md border', className)} aria-busy={isLoading}>
      {isLoading
        ? Array.from({ length: 3 }, (_, row) => (
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

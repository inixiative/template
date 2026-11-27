/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { loadingMaskAttributes } from '@template/ui/components/primitives/loadingMaskAttributes';
import { PlaceholderText } from '@template/ui/components/primitives/PlaceholderText';
import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';
import { Fragment } from 'react';

export type ListProps<T> = {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyMessage?: string;
  isLoading?: boolean;
  // An item while loading, shaped like what renderItem returns; drawn three times.
  placeholderItem?: React.ReactNode;
  className?: string;
};

const placeholderWidths = ['40%', '55%', '30%'];

export const List = <T,>({
  items,
  renderItem,
  emptyMessage,
  isLoading = false,
  placeholderItem,
  className,
}: ListProps<T>) => {
  if (!isLoading && items.length === 0)
    return emptyMessage ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null;

  return (
    <ul
      className={cn('divide-y rounded-md border', className)}
      {...loadingMaskAttributes(isLoading)}
    >
      {isLoading
        ? Array.from({ length: 3 }, (_, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
            <Fragment key={row}>
              {placeholderItem ?? (
                <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <PlaceholderText width={placeholderWidths[row % placeholderWidths.length]} />
                  <PlaceholderText width="4rem" />
                </li>
              )}
            </Fragment>
          ))
        : items.map(renderItem)}
    </ul>
  );
};

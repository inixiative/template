/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

import { SkeletonStatus } from '@template/ui/components/primitives/SkeletonStatus';
import { SkeletonText } from '@template/ui/components/primitives/SkeletonText';
import { skeletonAttributes } from '@template/ui/components/primitives/skeletonAttributes';
import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';
import { Fragment } from 'react';

export type ListProps<T> = {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyMessage?: string;
  isLoading?: boolean;
  // An item while loading, built from the same row layout renderItem uses; drawn three times.
  skeletonItem?: React.ReactNode;
  className?: string;
};

export const List = <T,>({
  items,
  renderItem,
  emptyMessage,
  isLoading = false,
  skeletonItem,
  className,
}: ListProps<T>) => {
  if (!isLoading && items.length === 0)
    return emptyMessage ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null;

  return (
    <>
      <SkeletonStatus isLoading={isLoading} />
      <ul
        className={cn('divide-y rounded-md border', className)}
        {...skeletonAttributes(isLoading)}
      >
        {isLoading
          ? Array.from({ length: 3 }, (_, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no identity
              <Fragment key={row}>
                {skeletonItem ?? (
                  <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <SkeletonText widthIndex={row} />
                    <SkeletonText width="4rem" />
                  </li>
                )}
              </Fragment>
            ))
          : items.map(renderItem)}
      </ul>
    </>
  );
};

/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

const Skeleton = ({ className, ...props }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={cn('animate-pulse rounded-md bg-muted/50', className)}
    {...props}
  />
);

export type { SkeletonProps };
export { Skeleton };

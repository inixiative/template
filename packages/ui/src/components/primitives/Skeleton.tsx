import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  count?: number;
  show?: boolean | (() => boolean);
};

export const Skeleton = ({ className, count = 1, show = true, ...props }: SkeletonProps) => {
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  if (count <= 1) {
    return <div className={cn('h-4 w-full animate-pulse rounded-md bg-muted', className)} {...props} />;
  }

  const rows = Array.from({ length: count }, (_, item) => item + 1);

  return (
    <div className="space-y-2" {...props}>
      {rows.map((row) => (
        <div key={row} className={cn('h-4 w-full animate-pulse rounded-md bg-muted', className)} />
      ))}
    </div>
  );
};

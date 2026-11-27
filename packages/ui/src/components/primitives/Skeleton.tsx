/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & { isLoading?: boolean };

const pulse = 'animate-pulse rounded-md bg-muted/50';

const maskedContent = [
  'pointer-events-none',
  'select-none',
  'animate-pulse',
  '[&_:is(h1,h2,h3,h4,p,dt,dd,label,a,button,input,textarea,select)]:rounded-md',
  '[&_:is(h1,h2,h3,h4,p,dt,dd,label,a,button,input,textarea,select)]:bg-muted/50',
  '[&_:is(h1,h2,h3,h4,p,dt,dd,label,a,button,input,textarea,select)]:text-transparent',
  '[&_:is(h1,h2,h3,h4,p,dt,dd,label,a,button,input,textarea,select)]:border-transparent',
  '[&_:is(h1,h2,h3,h4,p,dt,dd,label,a,button,input,textarea,select)]:shadow-none',
  '[&_:is(h1,h2,h3,h4,p,dt,dd,label,a,button,input,textarea,select)]:placeholder:text-transparent',
  '[&_img]:invisible',
  '[&_svg]:invisible',
].join(' ');

const Skeleton = ({ isLoading = true, children, className, ...props }: SkeletonProps) => {
  if (children === undefined)
    return <div aria-hidden="true" className={cn(pulse, className)} {...props} />;
  if (!isLoading) return <>{children}</>;
  return (
    <div aria-busy="true" inert className={cn(maskedContent, className)} {...props}>
      {children}
    </div>
  );
};

export type { SkeletonProps };
export { Skeleton };

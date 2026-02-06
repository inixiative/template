import * as React from 'react';
import { cn } from '@ui/lib/utils';

export type AvatarProps = {
  className?: string;
  children: React.ReactNode;
  show?: boolean | (() => boolean);
};

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, children, show = true, ...props }, ref) => {
    const shouldShow = typeof show === 'function' ? show() : show;
    if (!shouldShow) return null;

    return (
      <div
        ref={ref}
        className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Avatar.displayName = 'Avatar';

export type AvatarImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, alt, ...props }, ref) => {
    const [isError, setIsError] = React.useState(false);

    if (isError) return null;

    return (
      <img
        ref={ref}
        alt={alt}
        className={cn('aspect-square h-full w-full object-cover', className)}
        onError={() => setIsError(true)}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = 'AvatarImage';

export type AvatarFallbackProps = {
  className?: string;
  children: React.ReactNode;
};

export const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
AvatarFallback.displayName = 'AvatarFallback';

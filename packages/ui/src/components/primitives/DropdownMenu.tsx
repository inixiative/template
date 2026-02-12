import * as Ariakit from '@ariakit/react';
import { cn } from '@template/ui/lib/utils';

export type DropdownMenuProps = {
  children: React.ReactNode;
};

export const DropdownMenu = ({ children }: DropdownMenuProps) => {
  return <Ariakit.MenuProvider>{children}</Ariakit.MenuProvider>;
};

export type DropdownMenuTriggerProps = {
  children: React.ReactNode;
  className?: string;
};

export const DropdownMenuTrigger = ({ children, className }: DropdownMenuTriggerProps) => {
  return <Ariakit.MenuButton className={cn('cursor-pointer', className)}>{children}</Ariakit.MenuButton>;
};

export type DropdownMenuContentProps = {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end';
};

export const DropdownMenuContent = ({ children, className, align = 'start' }: DropdownMenuContentProps) => {
  return (
    <Ariakit.Menu
      gutter={8}
      shift={-8}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'data-[enter]:animate-in data-[leave]:animate-out',
        'data-[leave]:fade-out-0 data-[enter]:fade-in-0',
        'data-[leave]:zoom-out-95 data-[enter]:zoom-in-95',
        align === 'end' && 'origin-top-right',
        className,
      )}
    >
      {children}
    </Ariakit.Menu>
  );
};

export type DropdownMenuItemProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean | (() => boolean);
  disabledText?: string;
  className?: string;
  show?: boolean | (() => boolean);
};

export const DropdownMenuItem = ({
  children,
  onClick,
  disabled,
  disabledText,
  className,
  show = true,
}: DropdownMenuItemProps) => {
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  const shouldDisable = typeof disabled === 'function' ? disabled() : disabled;
  const isDisabled = shouldDisable || !!disabledText;
  const displayText = isDisabled && disabledText ? disabledText : children;

  return (
    <Ariakit.MenuItem
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:bg-accent focus-visible:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
    >
      {displayText}
    </Ariakit.MenuItem>
  );
};

export type DropdownMenuLabelProps = {
  children: React.ReactNode;
  className?: string;
};

export const DropdownMenuLabel = ({ children, className }: DropdownMenuLabelProps) => {
  return <div className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)}>{children}</div>;
};

export const DropdownMenuSeparator = ({ className }: { className?: string }) => {
  return <Ariakit.MenuSeparator className={cn('-mx-1 my-1 h-px bg-muted', className)} />;
};

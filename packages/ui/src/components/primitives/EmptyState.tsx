/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { Button } from '@template/ui/components/primitives/Button';
import { cn } from '@template/ui/lib/utils';

export type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  show?: boolean | (() => boolean);
};

export const EmptyState = ({ icon, title, description, action, className, show = true }: EmptyStateProps) => {
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-4 rounded-xl bg-background p-3 shadow-sm ring-1 ring-border">
          <Icon icon={icon} className="h-6 w-6 text-primary" />
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      {description && <p className="mb-5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
};

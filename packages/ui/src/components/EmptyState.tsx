import { type LucideIcon } from 'lucide-react';
import { cn } from '@ui/lib/utils';
import { Button } from './Button';

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  show?: boolean | (() => boolean);
};

export function EmptyState({ icon: Icon, title, description, action, className, show = true }: EmptyStateProps) {
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {Icon && (
        <div className="rounded-full bg-muted p-3 mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

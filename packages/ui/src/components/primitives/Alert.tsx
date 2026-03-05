import { cn } from '@template/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import * as React from 'react';

const alertVariants = cva('w-full rounded-lg border p-4', {
  variants: {
    tone: {
      default: 'border-border bg-card text-card-foreground',
      info: 'border-info bg-card text-info',
      success: 'border-success bg-success-1 text-success',
      warning: 'border-warning bg-card text-warning',
      error: 'border-error bg-error/10 text-error',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

const toneIcons = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title: string;
  icon?: React.ReactNode;
  show?: boolean | (() => boolean);
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, tone = 'default', title, icon, children, show = true, ...props }, ref) => {
    const shouldShow = typeof show === 'function' ? show() : show;
    if (!shouldShow) return null;

    const resolvedTone = tone ?? 'default';
    const Icon = toneIcons[resolvedTone];
    const role = resolvedTone === 'error' ? 'alert' : 'status';

    return (
      <div ref={ref} role={role} className={cn(alertVariants({ tone: resolvedTone }), className)} {...props}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5">{icon ?? <Icon className="h-4 w-4" />}</span>
          <div className="space-y-1">
            <p className="text-sm font-medium">{title}</p>
            {children && <div className="text-sm text-foreground">{children}</div>}
          </div>
        </div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';

export { alertVariants };

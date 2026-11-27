/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { cn } from '@template/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const badgeToneClassNames = {
  primary: 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]',
  tertiary: 'bg-[hsl(var(--tertiary)/0.12)] text-[hsl(var(--tertiary))]',
  quaternary: 'bg-[hsl(var(--quaternary)/0.12)] text-[hsl(var(--quaternary))]',
  warning: 'bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]',
  muted: 'bg-[hsl(var(--muted-foreground)/0.12)] text-[hsl(var(--muted-foreground))]',
};

type BadgeTone = keyof typeof badgeToneClassNames;

type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants> & { tone?: BadgeTone };

const Badge = ({ className, variant, tone, children, ...props }: BadgeProps) => (
  <div
    data-slot="badge"
    className={cn(
      badgeVariants({ variant: tone ? null : variant }),
      tone && 'h-6 shrink-0 gap-1.5 whitespace-nowrap border-transparent py-0 font-medium',
      tone && badgeToneClassNames[tone],
      className,
    )}
    {...props}
  >
    {tone ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
    {children}
  </div>
);

export type { BadgeProps, BadgeTone };
export { Badge, badgeVariants };

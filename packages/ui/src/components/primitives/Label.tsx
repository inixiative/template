/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { cn } from '@template/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, htmlFor, children, ...props }, ref) => {
    return (
      <label ref={ref} htmlFor={htmlFor} className={cn(labelVariants(), className)} {...props}>
        {children}
      </label>
    );
  },
);
Label.displayName = 'Label';

export { Label };

import { useFormFieldControl } from '@template/ui/components/primitives/FormField';
import { cn } from '@template/ui/lib/utils';
import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  show?: boolean | (() => boolean);
  disabledText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      show = true,
      disabledText,
      disabled,
      placeholder,
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const formFieldControl = useFormFieldControl();
    const shouldShow = typeof show === 'function' ? show() : show;
    if (!shouldShow) return null;

    const isDisabled = disabled || !!disabledText;
    const displayPlaceholder = isDisabled && disabledText ? disabledText : placeholder;
    const resolvedId = id ?? formFieldControl?.id;
    const resolvedAriaDescribedBy = ariaDescribedBy ?? formFieldControl?.ariaDescribedBy;
    const resolvedAriaInvalid = ariaInvalid ?? (formFieldControl?.ariaInvalid || undefined);

    return (
      <input
        type={type}
        id={resolvedId}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        disabled={isDisabled}
        placeholder={displayPlaceholder}
        aria-describedby={resolvedAriaDescribedBy}
        aria-invalid={resolvedAriaInvalid}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };

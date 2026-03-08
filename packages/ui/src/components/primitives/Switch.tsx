import * as Ariakit from '@ariakit/react';
import { useFormFieldControl } from '@template/ui/components/primitives/FormField';
import { cn } from '@template/ui/lib/utils';
import * as React from 'react';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  show?: boolean | (() => boolean);
  disabledText?: string;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      className,
      checked,
      onCheckedChange,
      show = true,
      disabledText,
      disabled,
      onChange,
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
    const resolvedId = id ?? formFieldControl?.id;
    const resolvedAriaDescribedBy = ariaDescribedBy ?? formFieldControl?.ariaDescribedBy;
    const resolvedAriaInvalid = ariaInvalid ?? (formFieldControl?.ariaInvalid || undefined);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(event.currentTarget.checked);
      onChange?.(event);
    };

    const toggle = (
      <Ariakit.Checkbox
        ref={ref}
        id={resolvedId}
        role="switch"
        checked={checked}
        disabled={isDisabled}
        aria-describedby={resolvedAriaDescribedBy}
        aria-invalid={resolvedAriaInvalid}
        className={cn(
          'relative h-6 w-11 appearance-none rounded-full border border-input bg-background transition-colors',
          'after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-foreground after:transition-transform',
          'data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:after:translate-x-5 data-[checked]:after:bg-primary-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        onChange={handleChange}
        {...props}
      />
    );

    if (checked === undefined) {
      return toggle;
    }

    return <Ariakit.CheckboxProvider value={checked}>{toggle}</Ariakit.CheckboxProvider>;
  },
);
Switch.displayName = 'Switch';

export { Switch };

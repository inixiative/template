import * as Ariakit from '@ariakit/react';
import { useFormFieldControl } from '@template/ui/components/primitives/FormField';
import { cn } from '@template/ui/lib/utils';
import * as React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  show?: boolean | (() => boolean);
  disabledText?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      checked,
      onCheckedChange,
      indeterminate = false,
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
    const checkboxRef = React.useRef<HTMLInputElement | null>(null);
    const shouldShow = typeof show === 'function' ? show() : show;
    const isDisabled = disabled || !!disabledText;
    const checkedState: boolean | 'mixed' | undefined = indeterminate ? 'mixed' : checked;
    const resolvedId = id ?? formFieldControl?.id;
    const resolvedAriaDescribedBy = ariaDescribedBy ?? formFieldControl?.ariaDescribedBy;
    const resolvedAriaInvalid = ariaInvalid ?? (formFieldControl?.ariaInvalid || undefined);

    const handleRef = (node: HTMLInputElement | null) => {
      checkboxRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    React.useEffect(() => {
      if (!checkboxRef.current) return;
      checkboxRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    if (!shouldShow) return null;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(event.currentTarget.checked);
      onChange?.(event);
    };

    const checkbox = (
      <Ariakit.Checkbox
        ref={handleRef}
        id={resolvedId}
        checked={checkedState}
        disabled={isDisabled}
        aria-describedby={resolvedAriaDescribedBy}
        aria-invalid={resolvedAriaInvalid}
        className={cn(
          'peer h-4 w-4 shrink-0 rounded-sm border border-input bg-background text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        onChange={handleChange}
        {...props}
      />
    );

    if (checked === undefined && !indeterminate) {
      return checkbox;
    }

    return <Ariakit.CheckboxProvider value={checkedState ?? false}>{checkbox}</Ariakit.CheckboxProvider>;
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };

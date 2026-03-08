import { useFormFieldControl } from '@template/ui/components/primitives/FormField';
import { cn } from '@template/ui/lib/utils';
import * as React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  resize?: 'none' | 'vertical' | 'auto';
  show?: boolean | (() => boolean);
  disabledText?: string;
}

const resizeVariants: Record<NonNullable<TextareaProps['resize']>, string> = {
  none: 'resize-none',
  vertical: 'resize-y',
  auto: 'resize-none overflow-hidden',
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      resize = 'vertical',
      show = true,
      disabledText,
      disabled,
      placeholder,
      onChange,
      value,
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const formFieldControl = useFormFieldControl();
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const shouldShow = typeof show === 'function' ? show() : show;
    const isDisabled = disabled || !!disabledText;
    const displayPlaceholder = isDisabled && disabledText ? disabledText : placeholder;
    const resolvedId = id ?? formFieldControl?.id;
    const resolvedAriaDescribedBy = ariaDescribedBy ?? formFieldControl?.ariaDescribedBy;
    const resolvedAriaInvalid = ariaInvalid ?? (formFieldControl?.ariaInvalid || undefined);

    const syncHeight = React.useCallback(() => {
      if (resize !== 'auto' || !textareaRef.current) return;
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }, [resize]);

    React.useEffect(() => {
      if (value !== undefined) {
        syncHeight();
        return;
      }
      syncHeight();
    }, [syncHeight, value]);

    if (!shouldShow) return null;

    const handleRef = (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (resize === 'auto') {
        event.currentTarget.style.height = 'auto';
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
      }
      onChange?.(event);
    };

    return (
      <textarea
        id={resolvedId}
        ref={handleRef}
        disabled={isDisabled}
        value={value}
        placeholder={displayPlaceholder}
        aria-describedby={resolvedAriaDescribedBy}
        aria-invalid={resolvedAriaInvalid}
        className={cn(
          'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          resizeVariants[resize],
          className,
        )}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };

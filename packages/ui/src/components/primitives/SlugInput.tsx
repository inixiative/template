import * as React from 'react';
import { Input, type InputProps } from './Input';

export interface SlugInputProps extends Omit<InputProps, 'onChange' | 'type'> {
  onChange?: (value: string) => void;
}

const SlugInput = React.forwardRef<HTMLInputElement, SlugInputProps>(({ onChange, onPaste, ...props }, ref) => {
  const normalize = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalize(e.target.value);
    if (onChange) onChange(normalized);
    // Mutate the event value so uncontrolled usage works too
    e.target.value = normalized;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = normalize(e.clipboardData.getData('text'));
    const target = e.currentTarget;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const next = normalize(target.value.slice(0, start) + pasted + target.value.slice(end));
    if (onChange) onChange(next);
    // Update DOM value for uncontrolled usage
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    nativeInputValueSetter?.call(target, next);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    onPaste?.(e);
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="url"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="my-slug"
      {...props}
      onChange={handleChange}
      onPaste={handlePaste}
    />
  );
});
SlugInput.displayName = 'SlugInput';

export { SlugInput };

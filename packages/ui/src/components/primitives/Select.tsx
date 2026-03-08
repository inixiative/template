import type { SelectOption } from '@template/ui/lib/enumOptions';
import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';

type SelectProps<TValue extends string = string> = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> & {
  options: readonly SelectOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
};

export const Select = <TValue extends string>({
  className,
  options,
  value,
  onChange,
  ...props
}: SelectProps<TValue>) => {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      value={value}
      onChange={(event) => onChange(event.target.value as TValue)}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

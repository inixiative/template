import { Input as AriaInput, TextField, Label, type TextFieldProps } from 'react-aria-components';
import { cn } from '#/lib/utils';

export interface InputProps extends Omit<TextFieldProps, 'children'> {
  label?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  className?: string;
  inputClassName?: string;
}

export function Input({
  label,
  placeholder,
  type = 'text',
  className,
  inputClassName,
  ...props
}: InputProps) {
  return (
    <TextField className={cn('flex flex-col gap-1.5', className)} {...props}>
      {label && (
        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </Label>
      )}
      <AriaInput
        type={type}
        placeholder={placeholder}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          inputClassName,
        )}
      />
    </TextField>
  );
}

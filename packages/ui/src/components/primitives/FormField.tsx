import { Label } from '@template/ui/components/primitives/Label';
import { cn } from '@template/ui/lib/utils';
import * as React from 'react';

type FormFieldContextValue = {
  id: string;
  ariaDescribedBy?: string;
  ariaInvalid: boolean;
};

const FormFieldContext = React.createContext<FormFieldContextValue | undefined>(undefined);

export const useFormFieldControl = (): FormFieldContextValue | undefined => {
  return React.useContext(FormFieldContext);
};

export type FormFieldProps = {
  label: string;
  htmlFor?: string;
  help?: string;
  error?: string;
  required?: boolean;
  className?: string;
  show?: boolean | (() => boolean);
  children: React.ReactNode;
};

export const FormField = ({
  label,
  htmlFor,
  help,
  error,
  required = false,
  className,
  show = true,
  children,
}: FormFieldProps) => {
  const reactId = React.useId().replace(/:/g, '');
  const shouldShow = typeof show === 'function' ? show() : show;
  if (!shouldShow) return null;

  const fieldId = htmlFor ?? `field-${reactId}`;
  const helpId = help ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const ariaDescribedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FormFieldContext.Provider
      value={{
        id: fieldId,
        ariaDescribedBy,
        ariaInvalid: Boolean(error),
      }}
    >
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={fieldId} className={cn(required && 'after:ml-1 after:text-error after:content-["*"]')}>
          {label}
        </Label>
        {children}
        {help && (
          <p id={helpId} className="text-sm text-muted-foreground">
            {help}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </FormFieldContext.Provider>
  );
};

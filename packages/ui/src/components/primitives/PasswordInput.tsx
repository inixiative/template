import { Input, type InputProps } from '@template/ui/components/primitives/Input';
import { cn } from '@template/ui/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

export type PasswordInputProps = Omit<InputProps, 'type'> & {
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showPasswordLabel, hidePasswordLabel, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const toggleLabel = visible ? hidePasswordLabel : showPasswordLabel;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          autoComplete="current-password"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={toggleLabel}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };

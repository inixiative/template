/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useMutation } from '@tanstack/react-query';
import { QrCodeSvg } from '@template/ui/components/auth/QrCodeSvg';
import { Button } from '@template/ui/components/primitives/Button';
import { CopyButton } from '@template/ui/components/primitives/CopyButton';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';
import { describeError } from '@template/ui/lib/describeError';
import { type FormEvent, useState } from 'react';

export type TotpSetupState = {
  secret: string;
  otpauthUri: string;
};

type TotpEnrollFormProps = {
  setup: TotpSetupState;
  onConfirm: (code: string) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
};

export const TotpEnrollForm = ({
  setup,
  onConfirm,
  onCancel,
  submitLabel = 'Confirm authenticator app',
}: TotpEnrollFormProps) => {
  const [code, setCode] = useState('');
  const confirmMutation = useMutation({
    throwOnError: false,
    meta: { skipErrorToast: true },
    mutationFn: onConfirm,
  });

  const errorMessage = confirmMutation.error
    ? (() => {
        const described = describeError(confirmMutation.error, 'Invalid authenticator code');
        return described.detail || described.message;
      })()
    : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    confirmMutation.mutate(code);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
        <QrCodeSvg value={setup.otpauthUri} size={184} />
        <p className="text-center text-xs text-muted-foreground">
          Scan with your authenticator app, or enter this key manually:
        </p>
        <div className="flex items-center gap-2">
          <code className="rounded bg-background px-2 py-1 font-mono text-xs">{setup.secret}</code>
          <CopyButton value={setup.secret} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="totp-enroll-code">6-digit code from your authenticator app</Label>
        <Input
          id="totp-enroll-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          required
          disabled={confirmMutation.isPending}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={confirmMutation.isPending}>
          {confirmMutation.isPending ? 'Confirming…' : submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={confirmMutation.isPending}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

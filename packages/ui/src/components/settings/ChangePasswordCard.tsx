/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */

import { passwordLength } from '@template/shared/auth/passwordLength';
import type { ApiErrorBody } from '@template/shared/errors';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@template/ui/components';
import { describeError } from '@template/ui/lib/describeError';
import { formatFieldErrors } from '@template/ui/lib/formatFieldErrors';
import { useAppStore } from '@template/ui/store';
import { type FormEvent, useState } from 'react';

type Status = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'changed' };

const errorMessage = (error: unknown): string => {
  const fieldErrors = (error as Partial<ApiErrorBody> | null)?.fieldErrors;
  return fieldErrors ? formatFieldErrors(fieldErrors) : describeError(error).message;
};

export const ChangePasswordCard = () => {
  const changePassword = useAppStore((state) => state.auth.changePassword);
  const isSpoofing = useAppStore((state) => !!state.auth.spoofUserEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isSpoofing) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (newPassword !== confirmPassword) {
      setStatus({ kind: 'error', message: 'The new passwords do not match.' });
      return;
    }
    setIsSubmitting(true);
    setStatus({ kind: 'idle' });
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatus({ kind: 'changed' });
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              minLength={passwordLength.min}
              maxLength={passwordLength.max}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              minLength={passwordLength.min}
              maxLength={passwordLength.max}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {status.kind === 'error' && (
            <p role="alert" className="text-sm text-error-foreground">
              {status.message}
            </p>
          )}
          {status.kind === 'changed' && (
            <p role="status" className="text-sm text-muted-foreground">
              Password changed. Every other device is signed out.
            </p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Changing password...' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

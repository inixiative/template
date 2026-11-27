/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */

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
import { FormErrorAlert } from '@template/ui/components/auth/FormErrorAlert';
import { NewPasswordFields } from '@template/ui/components/auth/NewPasswordFields';
import { assertNewPasswordsMatch } from '@template/ui/lib/auth/assertNewPasswordsMatch';
import { changePassword } from '@template/ui/lib/auth/changePassword';
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
  const spoofUserEmail = useAppStore((state) => state.auth.spoofUserEmail);
  const applyUpgradedJwt = useAppStore((state) => state.auth.applyUpgradedJwt);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus({ kind: 'idle' });
    try {
      assertNewPasswordsMatch(newPassword, confirmPassword);
      const handoff = await changePassword({ currentPassword, newPassword });
      if (!spoofUserEmail && handoff.token) applyUpgradedJwt(handoff, false);
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
          <NewPasswordFields
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            disabled={isSubmitting}
          />

          {status.kind === 'error' && <FormErrorAlert message={status.message} />}
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

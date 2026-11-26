/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

import { passwordLength } from '@template/shared/auth/passwordLength';
import { AuthNoticeCard } from '@template/ui/components/auth/AuthNoticeCard';
import { FormErrorAlert } from '@template/ui/components/auth/FormErrorAlert';
import { Button } from '@template/ui/components/primitives/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives/Card';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';
import { resetPassword } from '@template/ui/lib/auth/resetPassword';
import { describeError } from '@template/ui/lib/describeError';
import { type FormEvent, useState } from 'react';

export type ResetPasswordFormProps = {
  token?: string;
  onPasswordReset: () => void;
  onRequestPasswordReset: () => void;
};

export const ResetPasswordForm = ({
  token,
  onPasswordReset,
  onRequestPasswordReset,
}: ResetPasswordFormProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinkInvalid, setIsLinkInvalid] = useState(!token);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !token) return;
    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setError(undefined);
    setIsSubmitting(true);
    try {
      const outcome = await resetPassword({ token, newPassword });
      if (outcome === 'linkInvalid') setIsLinkInvalid(true);
      else onPasswordReset();
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLinkInvalid) {
    return (
      <AuthNoticeCard
        title="Link expired"
        description="This reset link is invalid or has expired. Reset links work once, for one hour."
        role="alert"
        actionLabel="Send a new link"
        onAction={onRequestPasswordReset}
      />
    );
  }

  return (
    <Card className="w-full shadow-lg border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>
          Use {passwordLength.min} or more characters. Every device logged in to this account will
          be logged out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <FormErrorAlert message={error} />}

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={passwordLength.min}
              maxLength={passwordLength.max}
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
              autoComplete="new-password"
              minLength={passwordLength.min}
              maxLength={passwordLength.max}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving password...' : 'Set new password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

import { passwordLength } from '@template/shared/auth/passwordLength';
import { AuthCard } from '@template/ui/components/auth/AuthCard';
import { AuthNoticeCard } from '@template/ui/components/auth/AuthNoticeCard';
import { FormErrorAlert } from '@template/ui/components/auth/FormErrorAlert';
import { NewPasswordFields } from '@template/ui/components/auth/NewPasswordFields';
import { Button } from '@template/ui/components/primitives/Button';
import { assertNewPasswordsMatch } from '@template/ui/lib/auth/assertNewPasswordsMatch';
import { describeError } from '@template/ui/lib/describeError';
import { useAppStore } from '@template/ui/store';
import { type FormEvent, useState } from 'react';

export type ResetPasswordFormProps = {
  token?: string;
  onPasswordReset: () => void;
  onForgotPasswordClick: () => void;
};

export const ResetPasswordForm = ({
  token,
  onPasswordReset,
  onForgotPasswordClick,
}: ResetPasswordFormProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinkInvalid, setIsLinkInvalid] = useState(!token);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !token) return;
    setError(undefined);
    setIsSubmitting(true);
    try {
      assertNewPasswordsMatch(newPassword, confirmPassword);
      const result = await useAppStore.getState().auth.resetPassword({ token, newPassword });
      if (result.status === 'linkInvalid') setIsLinkInvalid(true);
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
        title="Link invalid or expired"
        description="This reset link is invalid or has expired. Reset links work once, for one hour."
        descriptionRole="alert"
        actionLabel="Send a new link"
        onAction={onForgotPasswordClick}
      />
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description={
        <>
          Use {passwordLength.min} or more characters. Every device logged in to this account will
          be logged out.
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <FormErrorAlert message={error} />}

        <NewPasswordFields
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          disabled={isSubmitting}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Saving password...' : 'Set new password'}
        </Button>
      </form>
    </AuthCard>
  );
};

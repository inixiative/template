/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useSearch } from '@tanstack/react-router';
import { AuthPageShell } from '@template/ui/components/auth/AuthPageShell';
import { ResetPasswordForm } from '@template/ui/components/auth/ResetPasswordForm';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';

export const ResetPasswordPage = () => {
  const currentAppStore = useAppStore.getState;
  const { token } = useSearch({ strict: false }) as { token?: string };

  const handlePasswordReset = () => {
    toast.success('Password reset. Log in with your new password.');
    currentAppStore().navigation.navigateKeepingSearchParams('/login', 'context');
  };

  const handleRequestPasswordReset = () =>
    currentAppStore().navigation.navigateKeepingSearchParams('/forgot-password', 'context');

  return (
    <AuthPageShell subtitle="Set a new password for your account">
      <ResetPasswordForm
        token={token}
        onPasswordReset={handlePasswordReset}
        onRequestPasswordReset={handleRequestPasswordReset}
      />
    </AuthPageShell>
  );
};

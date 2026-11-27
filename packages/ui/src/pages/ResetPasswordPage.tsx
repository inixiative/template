/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useSearch } from '@tanstack/react-router';
import { AuthPageShell } from '@template/ui/components/auth/AuthPageShell';
import { ResetPasswordForm } from '@template/ui/components/auth/ResetPasswordForm';
import { navigateToForgotPassword, navigateToLogin } from '@template/ui/lib/routeRedirect';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';

export const ResetPasswordPage = () => {
  const currentAppStore = useAppStore.getState;
  const { token, error } = useSearch({ strict: false }) as { token?: string; error?: string };

  const handlePasswordReset = () => {
    toast.success('Password reset. Log in with your new password.');
    navigateToLogin(currentAppStore, true);
  };

  return (
    <AuthPageShell subtitle="Set a new password for your account">
      <ResetPasswordForm
        token={error ? undefined : token}
        onPasswordReset={handlePasswordReset}
        onRequestPasswordReset={() => navigateToForgotPassword(currentAppStore, true)}
      />
    </AuthPageShell>
  );
};

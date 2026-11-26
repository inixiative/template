/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { AuthPageShell } from '@template/ui/components/auth/AuthPageShell';
import { ForgotPasswordForm } from '@template/ui/components/auth/ForgotPasswordForm';
import { navigateToLogin } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';

export const ForgotPasswordPage = () => {
  const currentAppStore = useAppStore.getState;

  return (
    <AuthPageShell subtitle="Get back into your account">
      <ForgotPasswordForm onLoginClick={() => navigateToLogin(currentAppStore, true)} />
    </AuthPageShell>
  );
};

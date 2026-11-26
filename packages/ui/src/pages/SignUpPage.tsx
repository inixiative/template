/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { AuthPageShell } from '@template/ui/components/auth/AuthPageShell';
import { SignUpForm } from '@template/ui/components/auth/SignUpForm';
import { navigateToLogin } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';

export const SignUpPage = () => {
  const currentAppStore = useAppStore.getState;

  return (
    <AuthPageShell subtitle="Create your account to get started">
      <SignUpForm onLoginClick={() => navigateToLogin(currentAppStore, true)} />
    </AuthPageShell>
  );
};

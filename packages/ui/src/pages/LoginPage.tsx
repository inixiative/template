/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { AuthPageShell } from '@template/ui/components/auth/AuthPageShell';
import { LoginForm } from '@template/ui/components/auth/LoginForm';
import { navigateToForgotPassword, navigateToSignUp } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';

type LoginPageProps = {
  hideSignUp?: boolean;
  hideForgotPassword?: boolean;
};

export const LoginPage = ({ hideSignUp, hideForgotPassword }: LoginPageProps) => {
  const currentAppStore = useAppStore.getState;

  return (
    <AuthPageShell subtitle="Log in to continue to your account">
      <LoginForm
        hideSignUp={hideSignUp}
        onSignUpClick={hideSignUp ? undefined : () => navigateToSignUp(currentAppStore, true)}
        onForgotPasswordClick={
          hideForgotPassword ? undefined : () => navigateToForgotPassword(currentAppStore, true)
        }
      />
    </AuthPageShell>
  );
};

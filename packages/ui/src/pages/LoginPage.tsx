import { LoginForm } from '@template/ui/components/auth/LoginForm';
import { useAppStore } from '@template/ui/store';
import { navigateToSignup } from '@template/ui/lib/routeRedirect';

type LoginPageProps = {
  hideSignup?: boolean;
};

export const LoginPage = ({ hideSignup }: LoginPageProps) => {
  const getStore = useAppStore.getState;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <LoginForm
        hideSignup={hideSignup}
        onSignupClick={hideSignup ? undefined : () => navigateToSignup(getStore, true)}
      />
    </div>
  );
};

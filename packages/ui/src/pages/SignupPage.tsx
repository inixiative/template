import { SignupForm } from '@template/ui/components/auth/SignupForm';
import { useAppStore } from '@template/ui/store';
import { navigateToLogin } from '@template/ui/lib/routeRedirect';

export const SignupPage = () => {
  const getStore = useAppStore.getState;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignupForm onLoginClick={() => navigateToLogin(getStore, true)} />
    </div>
  );
};

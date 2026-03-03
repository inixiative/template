import { SignupForm } from '@template/ui/components/auth/SignupForm';
import { useAppStore } from '@template/ui/store';
import { navigateToLogin } from '@template/ui/lib/routeRedirect';

export const SignupPage = () => {
  const getStore = useAppStore.getState;
  const appName = useAppStore((state) => state.ui.appName);

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gradient-to-br from-muted via-background to-background">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Template <span className="text-muted-foreground font-normal">{appName}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Create your account to get started</p>
        </div>
        <SignupForm onLoginClick={() => navigateToLogin(getStore, true)} />
      </div>
    </div>
  );
};

import { LoginForm } from '@template/ui/components/auth/LoginForm';
import { useAppStore } from '@template/ui/store';
import { navigateToSignup } from '@template/ui/lib/routeRedirect';

type LoginPageProps = {
  hideSignup?: boolean;
};

export const LoginPage = ({ hideSignup }: LoginPageProps) => {
  const getStore = useAppStore.getState;
  const projectName = useAppStore((state) => state.ui.projectName);
  const appName = useAppStore((state) => state.ui.appName);

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gradient-to-br from-muted via-background to-background">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {projectName} <span className="text-muted-foreground font-normal">{appName}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Log in to continue to your account</p>
        </div>
        <LoginForm
          hideSignup={hideSignup}
          onSignupClick={hideSignup ? undefined : () => navigateToSignup(getStore, true)}
        />
      </div>
    </div>
  );
};

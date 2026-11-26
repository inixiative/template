/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

import { ForgotPasswordForm } from '@template/ui/components/auth/ForgotPasswordForm';
import { navigateToLogin } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';

export const ForgotPasswordPage = () => {
  const currentAppStore = useAppStore.getState;
  const projectName = useAppStore((state) => state.ui.projectName);
  const appName = useAppStore((state) => state.ui.appName);

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gradient-to-br from-muted via-background to-background">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {projectName} <span className="text-muted-foreground font-normal">{appName}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Get back into your account</p>
        </div>
        <ForgotPasswordForm onLoginClick={() => navigateToLogin(currentAppStore, true)} />
      </div>
    </div>
  );
};

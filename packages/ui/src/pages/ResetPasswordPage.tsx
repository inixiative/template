/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

import { useSearch } from '@tanstack/react-router';
import { ResetPasswordForm } from '@template/ui/components/auth/ResetPasswordForm';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';

export const ResetPasswordPage = () => {
  const currentAppStore = useAppStore.getState;
  const projectName = useAppStore((state) => state.ui.projectName);
  const appName = useAppStore((state) => state.ui.appName);
  const search = useSearch({ strict: false }) as { token?: string; error?: string };
  const token = search.error ? undefined : search.token;

  const handleReset = () => {
    toast.success('Password reset. Log in with your new password.');
    currentAppStore().navigation.navigateKeepingSearchParams('/login', 'context');
  };

  const handleRequestNewLink = () =>
    currentAppStore().navigation.navigateKeepingSearchParams('/forgot-password', 'context');

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gradient-to-br from-muted via-background to-background">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {projectName} <span className="text-muted-foreground font-normal">{appName}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Set a new password for your account</p>
        </div>
        <ResetPasswordForm
          token={token}
          onReset={handleReset}
          onRequestNewLink={handleRequestNewLink}
        />
      </div>
    </div>
  );
};

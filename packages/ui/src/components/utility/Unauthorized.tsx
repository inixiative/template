/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { Button } from '@template/ui/components/primitives/Button';
import { navigateToLogin } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';

export type UnauthorizedProps = {
  title?: string;
  message?: string;
};

export const Unauthorized = ({
  title = 'Access denied',
  message = "You don't have permission to access this page in the current context.",
}: UnauthorizedProps) => {
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const navigatePreserving = useAppStore((state) => state.navigation.navigatePreserving);
  const getStore = useAppStore.getState;

  const goToPrimary = () => {
    if (isAuthenticated) {
      navigatePreserving('/dashboard', 'spoof');
      return;
    }
    navigateToLogin(getStore);
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    goToPrimary();
  };

  const handlePrimaryAction = () => {
    goToPrimary();
  };

  const primaryActionLabel = isAuthenticated ? 'Go to dashboard' : 'Log in';

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-5 rounded-2xl bg-muted p-4 ring-1 ring-border">
          <Icon icon="lucide:lock-keyhole" className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {isAuthenticated && (
          <p className="mt-1 text-sm text-muted-foreground">
            If this page belongs to an organization or space, switch to it from the selector at the top left.
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={handleGoBack}>
            Go back
          </Button>
          <Button onClick={handlePrimaryAction}>{primaryActionLabel}</Button>
        </div>
      </div>
    </div>
  );
};

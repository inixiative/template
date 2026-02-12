import { AlertTriangle } from 'lucide-react';
import { useAppStore } from '@template/ui/store';
import { Button } from '@template/ui/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@template/ui/components/Card';

export type UnauthorizedProps = {
  title?: string;
  message?: string;
};

export const Unauthorized = ({
  title = 'Access Denied',
  message = "You don't have permission to access this page in the current context.",
}: UnauthorizedProps) => {
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const navigatePreservingSpoof = useAppStore((state) => state.navigation.navigatePreservingSpoof);

  const goToPrimary = () => {
    if (isAuthenticated) {
      navigatePreservingSpoof('/dashboard');
      return;
    }
    const redirectTo = `${window.location.pathname}${window.location.search}`;
    navigatePreservingSpoof(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
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

  const primaryActionLabel = isAuthenticated ? 'Go to Dashboard' : 'Log In';

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle>{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGoBack}>
              Go Back
            </Button>
            <Button onClick={handlePrimaryAction}>{primaryActionLabel}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

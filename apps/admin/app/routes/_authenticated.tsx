import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell, ErrorBoundary, RouteError, Unauthorized } from '@template/ui/components';
import { useAuthenticatedRouting } from '@template/ui/hooks';
import { requireAuth } from '#/guards';

const AuthenticatedLayout = () => {
  const { isAuthorized } = useAuthenticatedRouting();

  return (
    <AppShell>
      <ErrorBoundary>{isAuthorized ? <Outlet /> : <Unauthorized />}</ErrorBoundary>
    </AppShell>
  );
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
  errorComponent: ({ error }) => <RouteError error={error} />,
});

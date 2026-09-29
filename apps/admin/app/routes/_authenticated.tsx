/**
 * @atlas
 * @kind page
 * @uses primitive:ui
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell, ErrorBoundary, RouteError, Unauthorized } from '@template/ui/components';
import { requireAuth } from '@template/ui/guards';
import { useAuthenticatedRouting } from '@template/ui/hooks';

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

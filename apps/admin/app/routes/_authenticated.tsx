/**
 * @atlas
 * @kind page
 * @uses primitive:ui
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell, ErrorBoundary, RouteError, Unauthorized } from '@template/ui/components';
import { redirectToLoginUnlessAuthenticated } from '@template/ui/guards';
import { useSyncTenantContextWithUrlAndAuthorizeRoute } from '@template/ui/hooks';
import { MasterDataPreloader } from '@template/ui/lib';

const AuthenticatedLayout = () => {
  const { isAuthorized } = useSyncTenantContextWithUrlAndAuthorizeRoute();

  return (
    <AppShell>
      <MasterDataPreloader />
      <ErrorBoundary>{isAuthorized ? <Outlet /> : <Unauthorized />}</ErrorBoundary>
    </AppShell>
  );
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => redirectToLoginUnlessAuthenticated(ctx),
  component: AuthenticatedLayout,
  errorComponent: ({ error }) => <RouteError error={error} />,
});

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell, ErrorBoundary, RouteError, Unauthorized } from '@template/ui/components';
import { requireAuth } from '#/guards';
import { useAppStore } from '@template/ui/store';

const AuthenticatedLayout = () => {
  const permix = useAppStore((state) => state.permissions.permix);
  const isSuperadmin = permix.isSuperadmin?.() ?? false;

  if (!isSuperadmin) {
    return <Unauthorized />;
  }

  return (
    <AppShell lockedContext={true}>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </AppShell>
  );
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
  errorComponent: ({ error }) => <RouteError error={error} />,
});

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useAuthenticatedRouting } from '@template/ui/hooks';
import { AppShell, Unauthorized } from '@template/ui/components';
import { requireAuth } from '#/guards';

const AuthenticatedLayout = () => {
  const { isAuthorized } = useAuthenticatedRouting();

  return (
    <AppShell>
      {isAuthorized ? <Outlet /> : <Unauthorized />}
    </AppShell>
  );
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
});

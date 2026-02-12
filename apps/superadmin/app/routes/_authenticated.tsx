import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell, Unauthorized } from '@template/ui/components';
import { requireAuth } from '#/guards';
import { useAppStore } from '#/store';

const AuthenticatedLayout = () => {
  const permix = useAppStore((state) => state.permissions.permix);
  const isSuperadmin = permix.isSuperadmin?.() ?? false;

  if (!isSuperadmin) {
    return <Unauthorized />;
  }

  return (
    <AppShell lockedContext={true}>
      <Outlet />
    </AppShell>
  );
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
});

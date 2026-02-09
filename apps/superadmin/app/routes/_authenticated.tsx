import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { logout } from '@template/shared';
import { AppShell } from '@template/ui';
import { navConfig } from '#/config/nav';
import { requireAuth } from '#/guards';

const AuthenticatedLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell
      navConfig={navConfig}
      currentPath={location.pathname}
      lockedContext={true} // Prevent context switching - superadmin manages resources
      onNavigate={(path) => navigate({ to: path })}
      onLogout={async () => {
        await logout(import.meta.env.VITE_API_URL);
        navigate({ to: '/login' });
      }}
    >
      <Outlet />
    </AppShell>
  );
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
});

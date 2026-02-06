import { createFileRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import { AppShell } from '@template/ui';
import { Home, Users, Mail, Settings } from 'lucide-react';
import { useAppStore, initializeAuth, logout } from '@template/shared';
import { requireAuth } from '#/guards';
import { log } from '#/lib/logger';
import { useEffect } from 'react';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
});

const navSections = [
  {
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: Home,
      },
      {
        label: 'Users',
        path: '/users',
        icon: Users,
      },
      {
        label: 'Communications',
        path: '/communications',
        icon: Mail,
      },
      {
        label: 'Settings',
        path: '/settings',
        icon: Settings,
      },
    ],
  },
];

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAppStore((state) => state.auth);
  const permissions = useAppStore((state) => state.permissions);

  useEffect(() => {
    if (!auth.isInitialized) {
      initializeAuth().catch((error) => {
        log.error('Failed to initialize auth', error);
        navigate({
          to: '/login',
          search: { redirectTo: location.pathname },
        });
      });
    }
  }, [auth.isInitialized, navigate, location.pathname]);

  const user = {
    name: auth.user?.name || 'Superadmin',
    email: auth.user?.email || '',
    avatarUrl: undefined,
  };

  return (
    <AppShell
      logo={<div className="text-lg font-bold">Superadmin</div>}
      navSections={navSections}
      navContext={{}}
      currentPath={location.pathname}
      permissions={permissions}
      user={user}
      isSuperadmin={permissions.isSuperadmin()}
      onNavigate={(path) => navigate({ to: path })}
      onSettings={() => navigate({ to: '/settings' })}
      onLogout={async () => {
        try {
          await logout(import.meta.env.VITE_API_URL);
        } catch (error) {
          log.error('Logout failed', error);
        } finally {
          navigate({ to: '/login' });
        }
      }}
    >
      <Outlet />
    </AppShell>
  );
}

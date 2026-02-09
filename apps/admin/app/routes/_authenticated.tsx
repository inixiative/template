import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { logout, useAppStore, useAuthenticatedRouting } from '@template/shared';
import { AppShell, Unauthorized } from '@template/ui';
import { navConfig } from '#/config/nav';
import { requireAuth } from '#/guards';

const AuthenticatedLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAppStore((state) => state.auth);
  const tenant = useAppStore((state) => state.tenant);

  const { isUnauthorized } = useAuthenticatedRouting({
    pathname: location.pathname,
    search: location.search,
    navigate,
    navConfig,
  });

  return (
    <AppShell
      currentPath={location.pathname}
      onLogout={async () => {
        await logout(import.meta.env.VITE_API_URL);
        // Don't redirect - let permission check handle it
        // URL update effect will remove query params
        // If page isn't accessible in public context, will show Unauthorized
      }}
    >
      {isUnauthorized ? (
        <Unauthorized
          onGoHome={() => {
            if (auth.isAuthenticated) {
              tenant.setPersonal();
              navigate({ to: '/dashboard' });
            } else {
              navigate({ to: '/login' });
            }
          }}
        />
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
});

import { createFileRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import { AppShell } from '@template/ui';
import { useAppStore, initializeAuth, logout } from '@template/shared';
import { navConfig } from '#/config/nav';
import { requireAuth } from '#/guards';
import { log } from '#/lib/logger';
import { useEffect } from 'react';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const tenant = useAppStore((state) => state.tenant);
  const permissions = useAppStore((state) => state.permissions);
  const auth = useAppStore((state) => state.auth);

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

  const currentContext = {
    type: tenant.context.type,
    label: tenant.context.type === 'personal'
      ? 'Personal'
      : tenant.context.type === 'organization'
      ? tenant.context.organization?.name || 'Organization'
      : tenant.context.space?.name || 'Space',
    organizationId: tenant.context.organization?.id,
    spaceId: tenant.context.space?.id,
  };

  const organizations = auth.organizations || [];

  const navContext = {
    organization: tenant.context.organization,
    space: tenant.context.space,
  };

  const navSections = tenant.context.type === 'personal'
    ? navConfig.personal
    : tenant.context.type === 'organization'
    ? navConfig.organization
    : navConfig.space;

  const user = {
    name: auth.user?.name || 'User',
    email: auth.user?.email || '',
    avatarUrl: undefined,
  };

  return (
    <AppShell
      logo={<div className="text-lg font-bold">Admin</div>}
      currentContext={currentContext}
      organizations={organizations}
      navSections={navSections}
      navContext={navContext}
      currentPath={location.pathname}
      permissions={permissions}
      user={user}
      isSuperadmin={permissions.isSuperadmin()}
      isSpoofing={false}
      onSelectPersonal={() => tenant.setPersonal()}
      onSelectOrganization={(orgId) => {}}
      onSelectSpace={(orgId, spaceId) => {}}
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

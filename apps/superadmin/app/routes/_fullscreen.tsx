/**
 * @atlas
 * @kind page
 * @partOf superadmin
 * @uses primitive:ui
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { FullscreenLayout, Unauthorized } from '@template/ui/components';
import { redirectToLoginUnlessAuthenticated } from '@template/ui/guards';
import { useSyncTenantContextWithUrlAndAuthorizeRoute } from '@template/ui/hooks';

const FullscreenLayoutRoute = () => {
  const { isAuthorized } = useSyncTenantContextWithUrlAndAuthorizeRoute();

  return <FullscreenLayout>{isAuthorized ? <Outlet /> : <Unauthorized />}</FullscreenLayout>;
};

export const Route = createFileRoute('/_fullscreen')({
  beforeLoad: (ctx) => redirectToLoginUnlessAuthenticated(ctx),
  component: FullscreenLayoutRoute,
});

/**
 * @atlas
 * @kind page
 * @uses primitive:ui
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { FullscreenLayout, Unauthorized } from '@template/ui/components';
import { requireAuth } from '@template/ui/guards';
import { useAuthenticatedRouting } from '@template/ui/hooks';

const FullscreenLayoutRoute = () => {
  const { isAuthorized } = useAuthenticatedRouting();

  return <FullscreenLayout>{isAuthorized ? <Outlet /> : <Unauthorized />}</FullscreenLayout>;
};

export const Route = createFileRoute('/_fullscreen')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: FullscreenLayoutRoute,
});

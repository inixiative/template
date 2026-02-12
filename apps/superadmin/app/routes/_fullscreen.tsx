import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useAuthenticatedRouting } from '@template/ui/hooks';
import { FullscreenLayout, Unauthorized } from '@template/ui/components';
import { requireAuth } from '#/guards';

const FullscreenLayoutRoute = () => {
  const { isAuthorized } = useAuthenticatedRouting();

  return (
    <FullscreenLayout>
      {isAuthorized ? <Outlet /> : <Unauthorized />}
    </FullscreenLayout>
  );
};

export const Route = createFileRoute('/_fullscreen')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: FullscreenLayoutRoute,
});

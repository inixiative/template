import { createFileRoute } from '@tanstack/react-router';
import { LoginPage } from '@template/shared';
import { requireGuest } from '#/guards';
import { authClient } from '#/lib/auth';
import { useAppStore } from '#/store';

export const Route = createFileRoute('/_public/login')({
  beforeLoad: (ctx) => requireGuest(ctx),
  component: () => (
    <LoginPage
      authClient={authClient}
      onSuccess={(user, session) => useAppStore.getState().auth.hydrate({ user, session })}
    />
  ),
});

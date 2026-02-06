import { createFileRoute } from '@tanstack/react-router';
import { LoginPage } from '@template/shared';
import { authClient } from '#/lib/auth';
import { useAppStore } from '#/store';
import { requireGuest } from '#/guards';

export const Route = createFileRoute('/login')({
  beforeLoad: (ctx) => requireGuest(ctx),
  component: () => (
    <LoginPage
      authClient={authClient}
      onSuccess={(user, session) => useAppStore.getState().auth.hydrate({ user, session })}
    />
  ),
});

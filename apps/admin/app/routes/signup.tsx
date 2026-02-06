import { createFileRoute } from '@tanstack/react-router';
import { SignupPage } from '@template/shared';
import { authClient } from '#/lib/auth';
import { useAppStore } from '#/store';
import { requireGuest } from '#/guards';

export const Route = createFileRoute('/signup')({
  beforeLoad: (ctx) => requireGuest(ctx),
  component: () => (
    <SignupPage
      authClient={authClient}
      onSuccess={(user, session) => useAppStore.getState().auth.hydrate({ user, session })}
    />
  ),
});

import { createFileRoute } from '@tanstack/react-router';
import { SignupPage } from '@template/shared';
import { requireGuest } from '#/guards';
import { authClient } from '#/lib/auth';
import { useAppStore } from '#/store';

export const Route = createFileRoute('/_public/signup')({
  beforeLoad: (ctx) => requireGuest(ctx),
  component: () => (
    <SignupPage
      authClient={authClient}
      onSuccess={(user, session) => useAppStore.getState().auth.hydrate({ user, session })}
    />
  ),
});

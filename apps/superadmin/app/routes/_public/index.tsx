import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@template/shared';
import { requireGuest } from '#/guards';

export const Route = createFileRoute('/_public/')({
  beforeLoad: (ctx) => requireGuest(ctx),
  component: () => (
    <HomePage title="Platform Operations" subtitle="Superadmin dashboard for platform management" showSignup={false} />
  ),
});

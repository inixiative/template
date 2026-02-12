import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@template/ui/pages';
import { requirePublic } from '#/guards';

export const Route = createFileRoute('/_public/')({
  beforeLoad: (ctx) => requirePublic(ctx),
  component: () => (
    <HomePage title="Platform Operations" subtitle="Superadmin dashboard for platform management" showSignup={false} />
  ),
});

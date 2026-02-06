import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@template/shared';
import { requireGuest } from '#/guards';

export const Route = createFileRoute('/')({
  beforeLoad: () => requireGuest('/dashboard'),
  component: () => (
    <HomePage
      title="Platform Operations"
      subtitle="Superadmin dashboard for platform management"
    />
  ),
});

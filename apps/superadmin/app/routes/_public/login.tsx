import { createFileRoute } from '@tanstack/react-router';
import { LoginPage } from '@template/ui/pages';
import { requirePublic } from '#/guards';

export const Route = createFileRoute('/_public/login')({
  beforeLoad: (ctx) => requirePublic(ctx),
  component: () => <LoginPage hideSignup={true} />,
});

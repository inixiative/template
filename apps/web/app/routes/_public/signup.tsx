import { createFileRoute } from '@tanstack/react-router';
import { SignupPage } from '@template/ui/pages';
import { requirePublic } from '#/guards';

export const Route = createFileRoute('/_public/signup')({
  beforeLoad: (ctx) => requirePublic(ctx),
  component: () => <SignupPage />,
});

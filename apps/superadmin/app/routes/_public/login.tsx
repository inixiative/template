/**
 * @atlas
 * @kind page
 * @partOf superadmin
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { requirePublic } from '@template/ui/guards';
import { LoginPage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/login')({
  beforeLoad: (ctx) => requirePublic(ctx),
  component: () => <LoginPage hideSignup={true} />,
});

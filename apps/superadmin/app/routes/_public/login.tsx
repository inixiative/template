/**
 * @atlas
 * @kind page
 * @partOf superadmin
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { redirectAuthenticatedUserAwayFromPublicPage } from '@template/ui/guards';
import { LoginPage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/login')({
  beforeLoad: (ctx) => redirectAuthenticatedUserAwayFromPublicPage(ctx),
  component: () => <LoginPage hideSignUp={true} hideForgotPassword={true} />,
});

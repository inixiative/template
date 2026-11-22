/**
 * @atlas
 * @kind page
 * @partOf superadmin
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { redirectAuthenticatedUserAwayFromPublicPage } from '@template/ui/guards';
import { HomePage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/')({
  beforeLoad: (ctx) => redirectAuthenticatedUserAwayFromPublicPage(ctx),
  component: () => <HomePage showSignUp={false} />,
});

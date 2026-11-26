/**
 * @atlas
 * @kind page
 * @partOf feature:auth
 * @uses primitive:ui
 */

import { createFileRoute } from '@tanstack/react-router';
import { redirectAuthenticatedUserAwayFromPublicPage } from '@template/ui/guards';
import { ForgotPasswordPage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/forgot-password')({
  beforeLoad: (ctx) => redirectAuthenticatedUserAwayFromPublicPage(ctx),
  component: () => <ForgotPasswordPage />,
});

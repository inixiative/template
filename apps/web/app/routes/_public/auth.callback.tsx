/**
 * @atlas
 * @kind page
 * @partOf feature:auth
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { AuthCallbackPage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/auth/callback')({
  component: AuthCallbackPage,
});

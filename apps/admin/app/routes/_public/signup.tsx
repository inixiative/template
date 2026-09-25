/**
 * @atlas
 * @kind page
 * @partOf feature:auth
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { requirePublic } from '@template/ui/guards';
import { SignupPage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/signup')({
  beforeLoad: (ctx) => requirePublic(ctx),
  component: () => <SignupPage />,
});

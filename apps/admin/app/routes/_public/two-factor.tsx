/**
 * @atlas
 * @kind page
 * @partOf feature:auth
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { redirectUnlessTwoFactorRequired } from '@template/ui/guards';
import { TwoFactorPage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/two-factor')({
  beforeLoad: (ctx) => redirectUnlessTwoFactorRequired(ctx),
  component: () => <TwoFactorPage />,
});

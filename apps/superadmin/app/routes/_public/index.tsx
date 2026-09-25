/**
 * @atlas
 * @kind page
 * @partOf superadmin
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { requirePublic } from '@template/ui/guards';
import { HomePage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/')({
  beforeLoad: (ctx) => requirePublic(ctx),
  component: () => <HomePage showSignup={false} />,
});

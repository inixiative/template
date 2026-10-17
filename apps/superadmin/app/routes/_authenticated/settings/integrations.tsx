/**
 * @atlas
 * @kind page
 * @partOf superadmin
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { IntegrationsPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/settings/integrations')({
  component: IntegrationsPage,
});

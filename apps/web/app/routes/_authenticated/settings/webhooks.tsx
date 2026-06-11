/**
 * @atlas
 * @kind page
 * @partOf feature:webhooks
 */
import { createFileRoute } from '@tanstack/react-router';
import { WebhooksPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/settings/webhooks')({
  component: WebhooksPage,
});

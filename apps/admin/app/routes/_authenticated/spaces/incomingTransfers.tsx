/**
 * @atlas
 * @kind page
 * @partOf feature:tenancy
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { Unauthorized } from '@template/ui/components';
import { OrganizationIncomingTransfersPage } from '@template/ui/pages';
import { useAppStore } from '@template/ui/store';

export const Route = createFileRoute('/_authenticated/spaces/incomingTransfers')({
  component: SpacesIncomingTransfersPage,
});

function SpacesIncomingTransfersPage() {
  const context = useAppStore((state) => state.tenant.context);

  if (context.type === 'organization' && context.organization) {
    return <OrganizationIncomingTransfersPage />;
  }

  return <Unauthorized />;
}

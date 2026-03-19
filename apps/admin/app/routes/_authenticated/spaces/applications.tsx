import { createFileRoute } from '@tanstack/react-router';
import { Unauthorized } from '@template/ui/components';
import { OrganizationSpaceApplicationsPage } from '@template/ui/pages';
import { useAppStore } from '@template/ui/store';

export const Route = createFileRoute('/_authenticated/spaces/applications')({
  component: SpacesApplicationsPage,
});

function SpacesApplicationsPage() {
  const context = useAppStore((state) => state.tenant.context);

  if (context.type === 'organization' && context.organization) {
    return <OrganizationSpaceApplicationsPage organizationId={context.organization.id} />;
  }

  return <Unauthorized />;
}

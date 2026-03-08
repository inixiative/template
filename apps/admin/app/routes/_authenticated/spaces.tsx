import { createFileRoute } from '@tanstack/react-router';
import { Unauthorized } from '@template/ui/components';
import { OrganizationSpacesPage } from '@template/ui/pages';
import { useAppStore } from '@template/ui/store';

export const Route = createFileRoute('/_authenticated/spaces')({
  component: SpacesPage,
});

function SpacesPage() {
  const context = useAppStore((state) => state.tenant.context);

  if (context.type === 'organization' && context.organization) {
    return <OrganizationSpacesPage organizationId={context.organization.id} />;
  }

  return <Unauthorized />;
}

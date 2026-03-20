import { createFileRoute } from '@tanstack/react-router';
import { Unauthorized } from '@template/ui/components';
import { OrganizationSentInvitationsPage } from '@template/ui/pages';
import { useAppStore } from '@template/ui/store';

export const Route = createFileRoute('/_authenticated/users/invitations')({
  component: UsersInvitationsPage,
});

function UsersInvitationsPage() {
  const context = useAppStore((state) => state.tenant.context);

  if (context.type === 'organization' && context.organization) {
    return <OrganizationSentInvitationsPage organizationId={context.organization.id} />;
  }

  return <Unauthorized />;
}

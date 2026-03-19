import { createFileRoute } from '@tanstack/react-router';
import { Unauthorized } from '@template/ui/components';
import { OrganizationUsersPage } from '@template/ui/pages';
import { useAppStore } from '@template/ui/store';

export const Route = createFileRoute('/_authenticated/users/members')({
  component: UsersMembersPage,
});

function UsersMembersPage() {
  const context = useAppStore((state) => state.tenant.context);

  if (context.type === 'space' && context.space) {
    return <div>Space Users - TODO</div>;
  }

  if (context.type === 'organization' && context.organization) {
    return <OrganizationUsersPage organizationId={context.organization.id} />;
  }

  return <Unauthorized />;
}

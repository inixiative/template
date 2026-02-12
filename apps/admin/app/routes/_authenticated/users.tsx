import { createFileRoute } from '@tanstack/react-router';
import { OrganizationUsersPage } from '@template/ui/pages';
import { Unauthorized } from '@template/ui/components';
import { useAppStore } from '#/store';

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
});

function UsersPage() {
  const context = useAppStore((state) => state.tenant.context);

  // Context-aware: render appropriate users page based on current context
  if (context.type === 'space' && context.space) {
    return <div>Space Users - TODO</div>;
  }

  if (context.type === 'organization' && context.organization) {
    return <OrganizationUsersPage organizationId={context.organization.id} />;
  }

  // Must be in org or space context to access users
  return <Unauthorized />;
}

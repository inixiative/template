import { createFileRoute } from '@tanstack/react-router';
import { OrganizationUsersPage } from '@template/shared';

export const Route = createFileRoute('/_authenticated/org/$organizationId/users')({
  component: () => {
    const { organizationId } = Route.useParams();
    return <OrganizationUsersPage organizationId={organizationId} />;
  },
});

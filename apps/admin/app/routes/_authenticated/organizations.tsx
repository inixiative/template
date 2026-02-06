import { createFileRoute } from '@tanstack/react-router';
import { OrganizationsPage } from '@template/shared';

export const Route = createFileRoute('/_authenticated/organizations')({
  component: OrganizationsPage,
});

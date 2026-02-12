import { createFileRoute } from '@tanstack/react-router';
import { OrganizationsPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/organizations')({
  component: OrganizationsPage,
});

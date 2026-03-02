import { createFileRoute } from '@tanstack/react-router';
import { OrganizationAuthProvidersPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/settings/authProviders')({
  component: OrganizationAuthProvidersPage,
});

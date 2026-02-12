import { createFileRoute } from '@tanstack/react-router';
import { OrganizationAuthProvidersPage } from '@template/ui/pages';
import { checkContextPermission } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/settings/authProviders')({
  beforeLoad: async ({ context }) => {
    const { permissions, tenant } = context;
    if (!tenant.context.organization) {
      throw new Error('Auth providers only available in organization context');
    }
    checkContextPermission(permissions, tenant.context, 'own');
  },
  component: OrganizationAuthProvidersPage,
});

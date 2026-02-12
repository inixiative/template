import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '@template/ui/pages';
import { checkContextPermission } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/settings/profile')({
  beforeLoad: async ({ context }) => {
    const { permissions, tenant } = context;
    checkContextPermission(permissions, tenant.context, 'manage');
  },
  component: ProfilePage,
});

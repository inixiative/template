import { createFileRoute } from '@tanstack/react-router';
import { TokensPage } from '@template/ui/pages';
import { checkContextPermission } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/settings/tokens')({
  beforeLoad: async ({ context }) => {
    const { permissions, tenant } = context;
    checkContextPermission(permissions, tenant.context, 'operate');
  },
  component: TokensPage,
});

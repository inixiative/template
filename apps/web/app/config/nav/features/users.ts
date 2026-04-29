import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';

export const usersItem: NavItem = {
  label: 'Users',
  path: '/users',
  icon: 'lucide:users',
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
  items: [
    { label: 'Users', path: '/members' },
    {
      label: 'Invitations',
      path: '/invitations',
      access: (_permissions, context) => context.type === 'organization',
    },
  ],
};

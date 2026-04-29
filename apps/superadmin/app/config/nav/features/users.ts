import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';

export const usersItem: NavItem = {
  label: 'Users',
  path: '/users',
  icon: 'lucide:users',
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
};

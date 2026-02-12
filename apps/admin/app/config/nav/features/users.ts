import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';
import { Users } from 'lucide-react';

export const usersItem: NavItem = {
  label: 'Users',
  path: '/users',
  icon: Users,
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
};

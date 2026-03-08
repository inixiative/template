import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';
import { Home } from 'lucide-react';

export const dashboardItem: NavItem = {
  label: 'Dashboard',
  path: '/dashboard',
  icon: Home,
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
};

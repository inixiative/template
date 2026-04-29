import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';

export const dashboardItem: NavItem = {
  label: 'Dashboard',
  path: '/dashboard',
  icon: 'lucide:home',
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
};

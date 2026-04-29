import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';

export const organizationsItem: NavItem = {
  label: 'Organizations',
  path: '/organizations',
  icon: 'lucide:building2',
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
  items: [
    { label: 'My Organizations', path: '/mine' },
    { label: 'Invitations', path: '/invitations' },
  ],
};

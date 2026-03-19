import type { NavItem } from '@template/ui/components';
import { Building2 } from 'lucide-react';

export const organizationsItem: NavItem = {
  label: 'Organizations',
  path: '/organizations',
  icon: Building2,
  items: [
    { label: 'My Organizations', path: '/mine' },
    { label: 'Invitations', path: '/invitations' },
  ],
};

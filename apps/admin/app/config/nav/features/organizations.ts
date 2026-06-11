/**
 * @atlas
 * @kind config
 * @partOf feature:tenancy
 * @uses none
 */
import type { NavItem } from '@template/ui/components';

export const organizationsItem: NavItem = {
  label: 'Organizations',
  path: '/organizations',
  icon: 'lucide:building2',
  items: [
    { label: 'My Organizations', path: '/mine' },
    { label: 'Invitations', path: '/invitations' },
  ],
};

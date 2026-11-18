/**
 * @atlas
 * @kind config
 * @partOf superadmin
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib';

export const communicationsItem: NavItem = {
  label: 'Communications',
  path: '/communications',
  icon: 'lucide:mail',
  access: (permissions, context) =>
    permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
  items: [
    {
      label: 'Inquiries',
      path: '/inquiries',
      items: [
        { label: 'Platform', path: '/platform' },
        { label: 'All', path: '/all' },
      ],
    },
  ],
};

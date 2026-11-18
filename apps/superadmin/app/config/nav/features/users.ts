/**
 * @atlas
 * @kind config
 * @partOf superadmin
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib';

export const usersItem: NavItem = {
  label: 'Users',
  path: '/users',
  icon: 'lucide:users',
  access: (permissions, context) =>
    permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
};

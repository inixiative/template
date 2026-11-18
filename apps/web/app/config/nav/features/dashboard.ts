/**
 * @atlas
 * @kind config
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib';

export const dashboardItem: NavItem = {
  label: 'Dashboard',
  path: '/dashboard',
  icon: 'lucide:home',
  access: (permissions, context) =>
    permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
};

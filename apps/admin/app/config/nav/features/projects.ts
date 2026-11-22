/**
 * @atlas
 * @kind config
 * @partOf feature:project
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib';

export const projectsItem: NavItem = {
  label: 'Projects',
  path: '/projects',
  icon: 'lucide:folder-kanban',
  access: (permissions, context) =>
    permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
};

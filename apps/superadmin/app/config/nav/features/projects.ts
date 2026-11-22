/**
 * @atlas
 * @kind config
 * @partOf superadmin
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib';

const canReadProjects: NonNullable<NavItem['access']> = (permissions, context) =>
  permissions.check(...permissionCheckTargetForTenantContext(context), 'read');

export const projectsItem: NavItem = {
  label: 'Projects',
  path: '/projects',
  icon: 'lucide:folder-kanban',
  access: canReadProjects,
  items: [
    {
      label: 'Project',
      path: '/:id',
      alias: true,
      access: canReadProjects,
      items: [
        { label: 'Settings', path: '/settings', alias: true, access: canReadProjects },
        { label: 'Integrations', path: '/integrations', alias: true, access: canReadProjects },
      ],
    },
  ],
};

/**
 * @atlas
 * @kind config
 * @partOf feature:tenancy
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib';

export const spacesItem: NavItem = {
  label: 'Spaces',
  path: '/spaces',
  icon: 'lucide:folder-kanban',
  access: (permissions, context) =>
    permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
  items: [
    { label: 'Applications', path: '/applications' },
    { label: 'Incoming Transfers', path: '/incomingTransfers' },
  ],
};

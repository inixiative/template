/**
 * @atlas
 * @kind config
 * @partOf feature:segment
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib';

export const segmentsItem: NavItem = {
  label: 'Segments',
  path: '/segments',
  icon: 'lucide:layers',
  access: (permissions, context) =>
    permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
  items: [
    { label: 'Owned', path: '/owned' },
    { label: 'Memberships', path: '/memberships' },
  ],
};

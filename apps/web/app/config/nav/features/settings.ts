/**
 * @atlas
 * @kind config
 * @partOf feature:users
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { permissionCheckTargetForTenantContext } from '@template/ui/lib';

export const settingsItem: NavItem = {
  label: 'Settings',
  path: '/settings',
  icon: 'lucide:settings',
  access: (permissions, context) =>
    permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
  items: [
    {
      label: 'Settings',
      path: '/settings',
      icon: 'lucide:sliders-horizontal',
      access: (permissions, context) =>
        permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
    },
    {
      label: 'Profile',
      path: '/profile',
      icon: 'lucide:user',
      access: (permissions, context) =>
        permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
    },
    {
      label: 'Tokens',
      path: '/tokens',
      icon: 'lucide:key',
      access: (permissions, context) =>
        permissions.check(...permissionCheckTargetForTenantContext(context), 'operate'),
    },
    {
      label: 'Webhooks',
      path: '/webhooks',
      icon: 'lucide:webhook',
      access: (permissions, context) =>
        permissions.check(...permissionCheckTargetForTenantContext(context), 'operate'),
    },
    {
      label: 'Integrations',
      path: '/integrations',
      icon: 'lucide:plug',
      access: (permissions, context) =>
        permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
    },
    {
      label: 'Auth Providers',
      path: '/authProviders',
      icon: 'lucide:shield-check',
      access: (permissions, context) =>
        !!context.organization &&
        permissions.check(...permissionCheckTargetForTenantContext(context), 'own'),
    },
    {
      label: 'Update',
      path: '/update',
      icon: 'lucide:refresh-cw',
      access: (permissions, context) =>
        !!context.space &&
        permissions.check(...permissionCheckTargetForTenantContext(context), 'manage'),
    },
    {
      label: 'Transfer',
      path: '/transfer',
      icon: 'lucide:arrow-right-left',
      access: (permissions, context) =>
        !!context.space &&
        !!context.organization &&
        permissions.check(
          ...permissionCheckTargetForTenantContext({
            type: 'organization',
            organization: context.organization,
          }),
          'own',
        ),
    },
  ],
};

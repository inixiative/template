import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';

export const settingsItem: NavItem = {
  label: 'Settings',
  path: '/settings',
  icon: 'lucide:settings',
  access: (permissions, context) => permissions.check(...getContextParams(context), 'operate'),
  items: [
    {
      label: 'Profile',
      path: '/profile',
      icon: 'lucide:user',
      access: (permissions, context) => permissions.check(...getContextParams(context), 'manage'),
    },
    {
      label: 'Tokens',
      path: '/tokens',
      icon: 'lucide:key',
      access: (permissions, context) => permissions.check(...getContextParams(context), 'operate'),
    },
    {
      label: 'Webhooks',
      path: '/webhooks',
      icon: 'lucide:webhook',
      access: (permissions, context) => permissions.check(...getContextParams(context), 'operate'),
    },
    {
      label: 'Auth Providers',
      path: '/authProviders',
      icon: 'lucide:shield-check',
      access: (permissions, context) =>
        !!context.organization && permissions.check(...getContextParams(context), 'own'),
    },
    {
      label: 'Update',
      path: '/update',
      icon: 'lucide:refresh-cw',
      access: (permissions, context) => !!context.space && permissions.check(...getContextParams(context), 'manage'),
    },
    {
      label: 'Transfer',
      path: '/transfer',
      icon: 'lucide:arrow-right-left',
      access: (permissions, context) =>
        !!context.space &&
        !!context.organization &&
        permissions.check(...getContextParams({ type: 'organization', organization: context.organization }), 'own'),
    },
  ],
};

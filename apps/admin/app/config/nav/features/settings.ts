import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';
import { Settings, User, Key, Webhook, ShieldCheck } from 'lucide-react';

export const settingsItem: NavItem = {
  label: 'Settings',
  path: '/settings',
  icon: Settings,
  access: (permissions, context) => permissions.check(...getContextParams(context), 'operate'),
  items: [
    {
      label: 'Profile',
      path: '/profile',
      icon: User,
      access: (permissions, context) =>
        permissions.check(...getContextParams(context), 'manage'),
    },
    {
      label: 'Tokens',
      path: '/tokens',
      icon: Key,
      access: (permissions, context) =>
        permissions.check(...getContextParams(context), 'operate'),
    },
    {
      label: 'Webhooks',
      path: '/webhooks',
      icon: Webhook,
      access: (permissions, context) =>
        permissions.check(...getContextParams(context), 'operate'),
    },
    {
      label: 'Auth Providers',
      path: '/authProviders',
      icon: ShieldCheck,
      access: (permissions, context) =>
        context.organization && permissions.check(...getContextParams(context), 'own'),
    },
  ],
};

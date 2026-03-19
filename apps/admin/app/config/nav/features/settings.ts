import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';
import { ArrowRightLeft, Key, RefreshCw, Settings, ShieldCheck, User, Webhook } from 'lucide-react';

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
      access: (permissions, context) => permissions.check(...getContextParams(context), 'manage'),
    },
    {
      label: 'Tokens',
      path: '/tokens',
      icon: Key,
      access: (permissions, context) => permissions.check(...getContextParams(context), 'operate'),
    },
    {
      label: 'Webhooks',
      path: '/webhooks',
      icon: Webhook,
      access: (permissions, context) => permissions.check(...getContextParams(context), 'operate'),
    },
    {
      label: 'Auth Providers',
      path: '/authProviders',
      icon: ShieldCheck,
      access: (permissions, context) =>
        !!context.organization && permissions.check(...getContextParams(context), 'own'),
    },
    {
      label: 'Update',
      path: '/update',
      icon: RefreshCw,
      access: (permissions, context) => !!context.space && permissions.check(...getContextParams(context), 'manage'),
    },
    {
      label: 'Transfer',
      path: '/transfer',
      icon: ArrowRightLeft,
      access: (permissions, context) =>
        !!context.space && !!context.organization &&
        permissions.check(...getContextParams({ type: 'organization', organization: context.organization }), 'own'),
    },
  ],
};

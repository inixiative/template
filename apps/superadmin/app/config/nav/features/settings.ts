import type { NavItem } from '@template/ui/components';
import { Key, Settings, User, Webhook } from 'lucide-react';

export const settingsItem: NavItem = {
  label: 'Settings',
  path: '/settings',
  icon: Settings,
  items: [
    { label: 'Profile', path: '/profile', icon: User },
    { label: 'Tokens', path: '/tokens', icon: Key },
    { label: 'Webhooks', path: '/webhooks', icon: Webhook },
  ],
};

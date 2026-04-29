import type { NavItem } from '@template/ui/components';

export const settingsItem: NavItem = {
  label: 'Settings',
  path: '/settings',
  icon: 'lucide:settings',
  items: [
    { label: 'Profile', path: '/profile', icon: 'lucide:user' },
    { label: 'Tokens', path: '/tokens', icon: 'lucide:key' },
    { label: 'Webhooks', path: '/webhooks', icon: 'lucide:webhook' },
  ],
};

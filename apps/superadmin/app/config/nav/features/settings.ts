import type { NavItem } from '@template/ui/components';
import { getContextParams} from '@template/ui/lib';
import { Settings } from 'lucide-react';

export const settingsItem: NavItem = {
  label: 'Settings',
  path: '/settings',
  icon: Settings,
  access: (permissions, context) => permissions.check(...getContextParams(context), 'operate'),
};

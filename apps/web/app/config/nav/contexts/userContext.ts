import type { NavItem } from '@template/ui/components';
import { communicationsItem } from '#/config/nav/features/communications';
import { dashboardItem } from '#/config/nav/features/dashboard';
import { organizationsItem } from '#/config/nav/features/organizations';
import { settingsItem } from '#/config/nav/features/settings';

export const userContext: NavItem[] = [
  dashboardItem,
  organizationsItem,
  communicationsItem,
  settingsItem,
];

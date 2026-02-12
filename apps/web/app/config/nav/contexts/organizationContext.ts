import type { NavItem } from '@template/ui/components';
import { communicationsItem } from '#/config/nav/features/communications';
import { dashboardItem } from '#/config/nav/features/dashboard';
import { settingsItem } from '#/config/nav/features/settings';
import { spacesItem } from '#/config/nav/features/spaces';
import { usersItem } from '#/config/nav/features/users';

export const organizationContext: NavItem[] = [
  dashboardItem,
  spacesItem,
  usersItem,
  communicationsItem,
  settingsItem,
];

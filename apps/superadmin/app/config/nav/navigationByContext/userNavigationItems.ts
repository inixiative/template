/**
 * @atlas
 * @kind config
 * @partOf superadmin
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { communicationsItem } from '#/config/nav/features/communications';
import { dashboardItem } from '#/config/nav/features/dashboard';
import { organizationsItem } from '#/config/nav/features/organizations';
import { projectsItem } from '#/config/nav/features/projects';
import { settingsItem } from '#/config/nav/features/settings';
import { usersItem } from '#/config/nav/features/users';

export const userNavigationItems: NavItem[] = [
  dashboardItem,
  organizationsItem,
  projectsItem,
  usersItem,
  communicationsItem,
  settingsItem,
];

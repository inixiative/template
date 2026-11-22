/**
 * @atlas
 * @kind config
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { communicationsItem } from '#/config/nav/features/communications';
import { dashboardItem } from '#/config/nav/features/dashboard';
import { projectsItem } from '#/config/nav/features/projects';
import { settingsItem } from '#/config/nav/features/settings';
import { usersItem } from '#/config/nav/features/users';

export const spaceNavigationItems: NavItem[] = [
  dashboardItem,
  usersItem,
  projectsItem,
  communicationsItem,
  settingsItem,
];

/**
 * @atlas
 * @kind config
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { communicationsItem } from '#/config/nav/features/communications';
import { dashboardItem } from '#/config/nav/features/dashboard';
import { organizationsItem } from '#/config/nav/features/organizations';
import { projectsItem } from '#/config/nav/features/projects';
import { segmentsItem } from '#/config/nav/features/segments';
import { settingsItem } from '#/config/nav/features/settings';

export const userNavigationItems: NavItem[] = [
  dashboardItem,
  organizationsItem,
  projectsItem,
  segmentsItem,
  communicationsItem,
  settingsItem,
];

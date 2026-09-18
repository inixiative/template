/**
 * @atlas
 * @kind config
 * @uses none
 */
import type { NavItem } from '@template/ui/components';
import { communicationsItem } from '#/config/nav/features/communications';
import { dashboardItem } from '#/config/nav/features/dashboard';
import { segmentsItem } from '#/config/nav/features/segments';
import { settingsItem } from '#/config/nav/features/settings';
import { usersItem } from '#/config/nav/features/users';

export const spaceContext: NavItem[] = [dashboardItem, usersItem, segmentsItem, communicationsItem, settingsItem];

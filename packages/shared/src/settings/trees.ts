/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared
 * @uses none
 */
import { defaultTimezone, displayLocale } from '@template/shared/settings/pieces/localization';
import type { SettingTrees } from '@template/shared/settings/types';

export const SETTING_TREES = {
  User: {
    __read: 'read',
    __manage: 'manage',
    general: { __label: 'General', defaultTimezone, displayLocale },
  },
  Organization: {
    __read: 'read',
    __manage: 'manage',
    general: { __label: 'General', defaultTimezone, displayLocale },
  },
  Space: {
    __read: 'read',
    __manage: 'manage',
    general: { __label: 'General', defaultTimezone, displayLocale },
  },
  OrganizationUser: {
    __read: 'operate',
    __manage: 'operate',
    general: { __label: 'General', displayLocale },
  },
  SpaceUser: {
    __read: 'operate',
    __manage: 'operate',
    general: { __label: 'General', displayLocale },
  },
  Project: {
    __read: 'read',
    __manage: 'manage',
    general: { __label: 'General', defaultTimezone },
  },
  Integration: { __read: 'read', __manage: 'manage' },
  ProjectIntegration: { __read: 'read', __manage: 'manage' },
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific branches and `field:value` kinds below
  // ==========================================================================
} as const satisfies SettingTrees;

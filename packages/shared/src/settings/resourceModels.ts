/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
// Mirrors Prisma `SettingResourceModel` in packages/db/prisma/schema/setting.prisma
// (verified by packages/db/src/sharedEnumMirrors.test.ts).
export const SETTING_RESOURCE_MODELS = [
  'User',
  'Organization',
  'Space',
  'OrganizationUser',
  'SpaceUser',
  'Project',
  'Integration',
  'ProjectIntegration',
] as const;

export type SettingResourceModelName = (typeof SETTING_RESOURCE_MODELS)[number];

export const SETTING_PERMISSION_ACTIONS = ['read', 'operate', 'manage', 'own'] as const;

export type SettingPermissionAction = (typeof SETTING_PERMISSION_ACTIONS)[number];

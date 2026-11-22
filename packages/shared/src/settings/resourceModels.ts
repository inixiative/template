/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
import { z } from 'zod';

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

export const SettingResourceModelNameSchema = z.enum(SETTING_RESOURCE_MODELS);

export const SETTING_PERMISSION_ACTIONS = ['read', 'operate', 'manage', 'own'] as const;

export type SettingPermissionAction = (typeof SETTING_PERMISSION_ACTIONS)[number];

export const SettingPermissionActionSchema = z.enum(SETTING_PERMISSION_ACTIONS);

export type SettingPermissionSpec =
  | SettingPermissionAction
  | ({ readonly default?: SettingPermissionAction } & Partial<
      Record<SettingResourceModelName, SettingPermissionAction>
    >);

export const SettingPermissionSpecSchema = z.union([
  SettingPermissionActionSchema,
  z
    .object({
      default: SettingPermissionActionSchema.optional(),
      ...(Object.fromEntries(
        SETTING_RESOURCE_MODELS.map((model) => [model, SettingPermissionActionSchema.optional()]),
      ) as Record<SettingResourceModelName, z.ZodOptional<typeof SettingPermissionActionSchema>>),
    })
    .strict(),
]);

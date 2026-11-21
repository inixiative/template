/**
 * @atlas
 * @kind schema
 * @partOf feature:setting
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { AttributeValueTypeSchema } from '@template/shared/attributes';
import {
  SettingCategoryKeySchema,
  SettingKeySchema,
  SettingPermissionActionSchema,
} from '@template/shared/settings';
import { infoResponseSchema } from '#/lib/jsonSchema/infoResponseSchema';
import { jsonSchemaResponseSchema } from '#/lib/jsonSchema/jsonSchemaResponseSchema';

export const settingCategoryInfoSchema = z.object({
  key: SettingCategoryKeySchema.describe('Unique category key.'),
  label: z.string().describe('Human-readable category name.'),
  description: z.string().describe('What settings in this category control.'),
  order: z.number().int().describe('Display order relative to other categories.'),
});

export const settingDefinitionInfoSchema = z.object({
  key: SettingKeySchema.describe('Namespaced setting key.'),
  category: SettingCategoryKeySchema.describe('Category key under `types.categories`.'),
  label: z.string().describe('Human-readable setting name.'),
  description: z.string().describe('What this setting controls.'),
  resourceModels: z
    .array(z.nativeEnum(SettingResourceModel))
    .describe('Resource models this setting may attach to.'),
  valueType: AttributeValueTypeSchema.describe(
    'Typed attribute storage kind (`boolean`, `text`, `number`, `date`, `json`, or `multiSelect`).',
  ),
  schema: jsonSchemaResponseSchema.describe('JSON Schema of `value` accepted for this setting.'),
  defaultValue: z.unknown().describe('Effective default value when no active setting row exists.'),
  order: z.number().int().describe('Display order within its category.'),
  permission: SettingPermissionActionSchema.describe(
    'ReBAC action required on the setting resource to manage (write/delete) this setting.',
  ),
  readPermission: SettingPermissionActionSchema.describe(
    'ReBAC action required on the setting resource to read this setting.',
  ),
});

export const settingInfoResponseSchema = infoResponseSchema(
  z
    .object({
      categories: z
        .record(SettingCategoryKeySchema, settingCategoryInfoSchema)
        .describe('One entry per setting category.'),
      definitions: z
        .record(SettingKeySchema, settingDefinitionInfoSchema)
        .describe('One entry per registered setting key.'),
    })
    .describe('Registered setting categories and definitions.'),
);

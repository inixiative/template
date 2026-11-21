/**
 * @atlas
 * @kind schema
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import {
  decodeAttributeValue,
  decodeStoredAttributeValue,
  SettingScalarSchema,
} from '@template/db';
import type { Setting } from '@template/db/generated/client/client';
import { SettingResourceModel } from '@template/db/generated/client/enums';
import {
  AttributeValueTypeSchema,
  encodeAttributeValue,
  validateAttributeTypedColumns,
} from '@template/shared/attributes';
import {
  SettingCategoryKeySchema,
  SettingKeySchema,
  SettingPermissionActionSchema,
  settingDefinitionForKey,
} from '@template/shared/settings';
import { uuidV7Schema } from '@template/shared/utils';
import { polymorphicBodyRefinement } from '#/lib/routeTemplates';

const settingTargetFields = {
  resourceModel: z.nativeEnum(SettingResourceModel),
  resourceUserId: uuidV7Schema.optional(),
  resourceOrganizationId: uuidV7Schema.optional(),
  resourceSpaceId: uuidV7Schema.optional(),
  resourceProjectId: uuidV7Schema.optional(),
};

export const settingReadManyQuerySchema = z.object({
  ...settingTargetFields,
  category: SettingCategoryKeySchema.optional(),
  key: SettingKeySchema.optional(),
});

export const settingUpsertBodySchema = z.object({
  ...settingTargetFields,
  key: SettingKeySchema,
  value: z
    .unknown()
    .describe(
      'Shape depends on `key`; see GET /api/v1/setting/info (`types.definitions.<key>.schema`).',
    ),
  disabled: z.boolean().optional(),
});

export const settingTargetRefinement = polymorphicBodyRefinement('Setting', 'resourceModel');

export const settingUpsertBodyRefinement = (
  body: z.infer<typeof settingUpsertBodySchema>,
  ctx: z.RefinementCtx,
): void => {
  settingTargetRefinement(body, ctx);

  const definition = settingDefinitionForKey(body.key);
  if (!definition) {
    ctx.addIssue({
      code: 'custom',
      path: ['key'],
      message: `Unknown setting key '${body.key}'`,
    });
    return;
  }

  if (!definition.resourceModels.includes(body.resourceModel)) {
    ctx.addIssue({
      code: 'custom',
      path: ['resourceModel'],
      message: `Setting '${body.key}' cannot attach to ${body.resourceModel} (allowed: ${definition.resourceModels.join(', ')})`,
    });
  }

  if (body.value === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['value'],
      message: `value is required for setting '${body.key}'`,
    });
    return;
  }

  let encoded: ReturnType<typeof encodeAttributeValue>;
  try {
    encoded = encodeAttributeValue(definition.valueType, body.value);
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      path: ['value'],
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const checked = validateAttributeTypedColumns(definition.valueType, encoded, definition.schema);
  if (!checked.ok) {
    for (const issue of checked.issues) {
      ctx.addIssue({
        code: 'custom',
        path: ['value', ...(issue.path?.slice(1) ?? [])],
        message: issue.message,
      });
    }
  }
};

export const settingEffectiveItemSchema = z.object({
  key: SettingKeySchema,
  category: SettingCategoryKeySchema,
  valueType: AttributeValueTypeSchema,
  label: z.string(),
  description: z.string(),
  order: z.number().int(),
  permission: SettingPermissionActionSchema,
  defaultValue: z.unknown(),
  value: z.unknown(),
  storedValue: z.unknown(),
  disabled: z.boolean(),
  isDefault: z.boolean(),
  settingId: z.string().nullable(),
  updatedAt: z.date().nullable(),
});

export const settingReadResponseSchema = SettingScalarSchema.extend({
  value: z.unknown(),
  storedValue: z.unknown(),
});

export const settingAdminRowResponseSchema = SettingScalarSchema;

export const formatSettingRow = (row: Setting) => ({
  ...row,
  value: decodeAttributeValue('setting', row),
  storedValue: decodeStoredAttributeValue('setting', row),
});

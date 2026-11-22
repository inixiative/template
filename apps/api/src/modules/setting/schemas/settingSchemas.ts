/**
 * @atlas
 * @kind schema
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import {
  attributeColumnForValueType,
  attributeTypedColumnIssues,
} from '@template/shared/attributes';
import {
  SettingCategoryKeySchema,
  SettingKeySchema,
  type SettingResourceModelName,
  settingDefinitionForKey,
} from '@template/shared/settings';

export const settingListQuerySchema = z.object({
  category: SettingCategoryKeySchema.optional(),
  key: SettingKeySchema.optional(),
});

export type SettingListQuery = z.infer<typeof settingListQuerySchema>;

export const settingUpsertItemSchema = z.object({
  key: SettingKeySchema,
  value: z
    .unknown()
    .describe(
      'Shape depends on `key`; see GET /api/v1/setting/info (`types.definitions.<key>.schema`).',
    ),
  disabled: z.boolean().optional(),
});

export type SettingUpsertItem = z.infer<typeof settingUpsertItemSchema>;

/** Per-item Zod body refinement for parent-scoped batch `PATCH /.../settings` routes. */
export const makeSettingUpsertItemRefinement =
  (resourceModel: SettingResourceModelName) =>
  (item: SettingUpsertItem, ctx: z.RefinementCtx): void => {
    const definition = settingDefinitionForKey(item.key);
    if (!definition) {
      ctx.addIssue({
        code: 'custom',
        path: ['key'],
        message: `Unknown setting key '${item.key}'`,
      });
      return;
    }

    if (!definition.resourceModels.includes(resourceModel)) {
      ctx.addIssue({
        code: 'custom',
        path: ['key'],
        message: `Setting '${item.key}' cannot attach to ${resourceModel} (allowed: ${definition.resourceModels.join(', ')})`,
      });
      return;
    }

    if (item.value === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `value is required for setting '${item.key}'`,
      });
      return;
    }

    const targetColumn = attributeColumnForValueType(definition.valueType);
    const checked = attributeTypedColumnIssues(
      definition.valueType,
      { [targetColumn]: item.value },
      definition.schema,
    );
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

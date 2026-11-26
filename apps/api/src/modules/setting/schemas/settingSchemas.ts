/**
 * @atlas
 * @kind schema
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { AttributeValidationError, validateAttributeValue } from '@template/shared/attributes';
import { SettingKeySchema, settingDefinitionForKey } from '@template/shared/settings';

export const settingListQuerySchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Only settings at or under this key path in the resource tree (e.g. `general`).'),
  key: SettingKeySchema.optional(),
});

export type SettingListQuery = z.infer<typeof settingListQuerySchema>;

export const settingUpsertItemSchema = z.object({
  key: SettingKeySchema,
  value: z
    .unknown()
    .describe(
      'Shape depends on `key`; see GET /api/v1/setting/info (the leaf at that path in `types.trees.<resourceModel>`).',
    ),
  disabled: z.boolean().optional(),
});

export type SettingUpsertItem = z.infer<typeof settingUpsertItemSchema>;

/** Per-item Zod body refinement for parent-scoped batch `PATCH /.../settings` routes. */
export const settingUpsertItemRefinement = (
  item: SettingUpsertItem,
  ctx: z.RefinementCtx,
): void => {
  const definition = settingDefinitionForKey(item.key);
  if (!definition) {
    ctx.addIssue({
      code: 'custom',
      path: ['key'],
      message: `Unknown setting key '${item.key}'`,
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

  // why: Zod superRefine accumulates fieldErrors per array item via ctx.addIssue; letting a throw escape aborts safeParseAsync.
  try {
    validateAttributeValue(definition.valueType, item.value, definition.schema, {
      pathPrefix: ['value'],
    });
  } catch (err) {
    if (!(err instanceof AttributeValidationError)) throw err;
    for (const issue of err.issues) {
      ctx.addIssue({
        code: 'custom',
        path: issue.path ?? ['value'],
        message: issue.message,
      });
    }
  }
};

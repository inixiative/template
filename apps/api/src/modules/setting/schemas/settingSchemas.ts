/**
 * @atlas
 * @kind schema
 * @partOf feature:setting
 * @uses primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';

export const settingListQuerySchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Only settings at or under this key path in the resource tree (e.g. `general`).'),
  key: z.string().optional().describe('One setting, by its full path.'),
});

export type SettingListQuery = z.infer<typeof settingListQuerySchema>;

export const settingUpsertItemSchema = z.object({
  key: z.string().describe("The setting's full path in the resource's tree."),
  value: z
    .unknown()
    .describe(
      "Of the leaf's `valueType`, one of its `options` when it has them, passing its `conditions` when it has them; see GET /api/v1/setting/info.",
    ),
  disabled: z.boolean().optional(),
});

export type SettingUpsertItem = z.infer<typeof settingUpsertItemSchema>;

/**
 * @atlas
 * @kind schema
 * @partOf feature:setting
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { infoResponseSchema } from '#/lib/jsonSchema/infoResponseSchema';

export const settingTreeInfoSchema = z
  .record(z.string(), z.unknown())
  .describe(
    "One resource model's setting tree. A key starting `__` is metadata (`__label`, `__read`, `__manage`); a `field:value` key (e.g. `provider:linear`) holds settings only for resources of that kind and adds nothing to the path; any other key is a branch, or a leaf when it has `valueType` (with `schema` as JSON Schema, `defaultValue`, `label`, `description`). A setting's key is its path, joined with `.`. Permissions are the nearest `__read` / `__manage` up the path. Order is declaration order.",
  );

export const settingInfoResponseSchema = infoResponseSchema(
  z
    .object({
      trees: z
        .record(z.nativeEnum(SettingResourceModel), settingTreeInfoSchema)
        .describe('One setting tree per resource model.'),
    })
    .describe('Every setting, as one tree per resource model.'),
);

/**
 * @atlas
 * @kind schema
 * @partOf feature:contact
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { ContactType } from '@template/db/generated/client/enums';
import { infoResponseSchema } from '#/lib/jsonSchema/infoResponseSchema';
import { jsonSchemaResponseSchema } from '#/lib/jsonSchema/jsonSchemaResponseSchema';

export const contactTypeInfoSchema = z.object({
  label: z.string().describe('Display name.'),
  icon: z.string().describe('Iconify slug, such as `lucide:phone`.'),
  input: jsonSchemaResponseSchema.describe('JSON Schema of `value` in a create or update body.'),
  value: jsonSchemaResponseSchema.describe('JSON Schema of `value` as stored and returned.'),
  subtype: z
    .object({
      mode: z
        .enum(['forbidden', 'optional', 'required'])
        .describe('Whether a body may, must or must not send `subtype`.'),
      values: z.array(z.string()).describe('The `subtype` values allowed.'),
    })
    .describe('The rule for `subtype`.'),
  uniqueness: z
    .enum(['global-within-type', 'per-owner'])
    .describe(
      'Where no two contacts may share a value: within one owner (`per-owner`), or across all owners of the type (`global-within-type`).',
    ),
});

export const contactInfoResponseSchema = infoResponseSchema(
  z
    .record(z.nativeEnum(ContactType), contactTypeInfoSchema)
    .describe('One entry per contact `type`.'),
);

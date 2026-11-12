/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import { infoResponseSchema } from '#/lib/jsonSchema/infoResponseSchema';
import { jsonSchemaResponseSchema } from '#/lib/jsonSchema/jsonSchemaResponseSchema';

export const inquiryTypeInfoSchema = z.object({
  sources: z
    .array(z.nativeEnum(InquiryResourceModel))
    .describe('Models that may send this type: the `sourceModel` it accepts.'),
  targets: z
    .array(z.nativeEnum(InquiryResourceModel))
    .describe('Models it may be sent to. `targetModel` must be one of them.'),
  unique: z
    .enum(['targeted', 'untargeted'])
    .nullable()
    .describe(
      '`targeted`: one open inquiry per source, target and type. `untargeted`: one per source and type, whatever the target. `null`: no limit.',
    ),
  defaultExpirationDays: z
    .number()
    .int()
    .nullable()
    .describe('Days from sending until it expires. `null`: it never expires.'),
  content: jsonSchemaResponseSchema.describe(
    'JSON Schema of `content` in a create or update body.',
  ),
  resolutionInput: jsonSchemaResponseSchema.describe(
    'JSON Schema of the fields a resolve body accepts beside `status`.',
  ),
  resolution: jsonSchemaResponseSchema.describe(
    'JSON Schema of the `resolution` stored on resolve.',
  ),
});

export const inquiryInfoResponseSchema = infoResponseSchema(
  z
    .record(z.nativeEnum(InquiryType), inquiryTypeInfoSchema)
    .describe('One entry per inquiry `type`.'),
);

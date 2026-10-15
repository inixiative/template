/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import { jsonSchemaResponseSchema } from '#/lib/jsonSchema/jsonSchemaResponseSchema';

export const inquiryTypeInfoSchema = z.object({
  sources: z.array(z.nativeEnum(InquiryResourceModel)),
  targets: z.array(z.nativeEnum(InquiryResourceModel)),
  unique: z.enum(['targeted', 'untargeted']).nullable(),
  defaultExpirationDays: z.number().int().nullable(),
  content: jsonSchemaResponseSchema,
  resolutionInput: jsonSchemaResponseSchema,
  resolution: jsonSchemaResponseSchema,
});

export const inquiryInfoResponseSchema = z.object({
  types: z.record(z.nativeEnum(InquiryType), inquiryTypeInfoSchema),
});

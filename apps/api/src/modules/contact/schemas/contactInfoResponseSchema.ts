/**
 * @atlas
 * @kind schema
 * @partOf feature:contact
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { ContactType } from '@template/db/generated/client/enums';
import { jsonSchemaResponseSchema } from '#/lib/jsonSchema/jsonSchemaResponseSchema';

export const contactTypeInfoSchema = z.object({
  label: z.string(),
  icon: z.string(),
  input: jsonSchemaResponseSchema,
  value: jsonSchemaResponseSchema,
  subtype: z.object({
    mode: z.enum(['forbidden', 'optional', 'required']),
    values: z.array(z.string()),
  }),
  uniqueness: z.enum(['global-within-type', 'per-owner']),
});

export const contactInfoResponseSchema = z.object({
  types: z.record(z.nativeEnum(ContactType), contactTypeInfoSchema),
});

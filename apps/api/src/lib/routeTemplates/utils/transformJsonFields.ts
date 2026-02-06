import { z } from '@hono/zod-openapi';
import { mapValues } from 'lodash';

// JSON schema that properly types to Prisma's InputJsonValue
const InputJsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.record(z.string(), z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)]))),
    z.array(z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)]))),
  ]),
).openapi({
  type: 'object',
  description: 'JSON value (string, number, boolean, object, or array)',
  example: { key: 'value' },
});

/**
 * Transforms z.unknown() fields to InputJsonValueSchema for Prisma JSON compatibility.
 * Handles nullable and optional variants.
 */
export const transformJsonFields = (shape: Record<string, z.ZodTypeAny>): Record<string, z.ZodTypeAny> => {
  return mapValues(shape, (field) => {
    if (field instanceof z.ZodUnknown) {
      return InputJsonValueSchema;
    }
    if (field instanceof z.ZodNullable && field._def.innerType instanceof z.ZodUnknown) {
      return InputJsonValueSchema.nullable();
    }
    if (field instanceof z.ZodOptional && field._def.innerType instanceof z.ZodUnknown) {
      return InputJsonValueSchema.optional();
    }
    if (field instanceof z.ZodOptional && field._def.innerType instanceof z.ZodNullable) {
      if (field._def.innerType._def.innerType instanceof z.ZodUnknown) {
        return InputJsonValueSchema.nullable().optional();
      }
    }
    if (field instanceof z.ZodNullable && field._def.innerType instanceof z.ZodOptional) {
      if (field._def.innerType._def.innerType instanceof z.ZodUnknown) {
        return InputJsonValueSchema.optional().nullable();
      }
    }
    return field;
  });
};

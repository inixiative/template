import { z } from '@hono/zod-openapi';
import { mapValues } from 'lodash-es';

// JSON schema that properly types to Prisma's InputJsonValue
const InputJsonValueSchema: z.ZodType<unknown> = z
  .lazy(() =>
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.record(
        z.string(),
        z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)])),
      ),
      z.array(z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)]))),
    ]),
  )
  .openapi({
    type: 'object',
    description: 'JSON value (string, number, boolean, object, or array)',
    example: { key: 'value' },
  });

/**
 * Transforms z.unknown() fields to InputJsonValueSchema for Prisma JSON compatibility.
 * Handles nullable and optional variants.
 */
export const transformJsonFields = (shape: Record<string, z.ZodTypeAny>): Record<string, z.ZodTypeAny> => {
  const replaceUnknown = (field: z.ZodTypeAny): z.ZodTypeAny => {
    if (field instanceof z.ZodUnknown) return InputJsonValueSchema;

    if (field instanceof z.ZodOptional) {
      const inner = field.unwrap() as z.ZodTypeAny;
      const transformed = replaceUnknown(inner);
      return transformed === inner ? field : transformed.optional();
    }

    if (field instanceof z.ZodNullable) {
      const inner = field.unwrap() as z.ZodTypeAny;
      const transformed = replaceUnknown(inner);
      return transformed === inner ? field : transformed.nullable();
    }

    return field;
  };

  return mapValues(shape, (field) => {
    return replaceUnknown(field);
  });
};

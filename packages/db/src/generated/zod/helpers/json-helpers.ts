import * as z from 'zod';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };
export type InputJsonValue = JsonPrimitive | InputJsonValue[] | { [k: string]: InputJsonValue | null };
export type NullableJsonInput = JsonValue | 'JsonNull' | 'DbNull' | null;
export const transformJsonNull = (v?: NullableJsonInput) => {
  if (v == null || v === 'DbNull') return null;
  if (v === 'JsonNull') return null;
  return v as JsonValue;
};
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(), z.number(), z.boolean(), z.literal(null),
    z.record(z.string(), z.lazy(() => JsonValueSchema.optional())),
    z.array(z.lazy(() => JsonValueSchema)),
  ])
) as z.ZodType<JsonValue>;
export const InputJsonValueSchema: z.ZodType<InputJsonValue> = z.lazy(() =>
  z.union([
    z.string(), z.number(), z.boolean(),
    z.record(z.string(), z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)]))),
    z.array(z.lazy(() => z.union([InputJsonValueSchema, z.literal(null)]))),
  ])
) as z.ZodType<InputJsonValue>;
export const NullableJsonValue = z
  .union([JsonValueSchema, z.literal('DbNull'), z.literal('JsonNull'), z.literal(null)])
  .transform((v) => transformJsonNull(v as NullableJsonInput));

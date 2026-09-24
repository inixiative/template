/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import { z } from 'zod';

type WireField<F> = F extends z.ZodDate
  ? z.ZodISODateTime
  : F extends z.ZodNullable<z.ZodDate>
    ? z.ZodNullable<z.ZodISODateTime>
    : F extends z.ZodOptional<z.ZodDate>
      ? z.ZodOptional<z.ZodISODateTime>
      : F;

export type JsonWireShape<S extends z.ZodRawShape> = { [K in keyof S]: WireField<S[K]> };

const wireField = (field: z.ZodType): z.ZodType => {
  if (field instanceof z.ZodDate) return z.iso.datetime();
  if (field instanceof z.ZodNullable && field.unwrap() instanceof z.ZodDate) return z.iso.datetime().nullable();
  if (field instanceof z.ZodOptional && field.unwrap() instanceof z.ZodDate) return z.iso.datetime().optional();
  return field;
};

export const jsonWireSchema = <S extends z.ZodRawShape>(schema: z.ZodObject<S>): z.ZodObject<JsonWireShape<S>> =>
  z.object(
    Object.fromEntries(Object.entries(schema.shape).map(([key, field]) => [key, wireField(field as z.ZodType)])),
  ) as unknown as z.ZodObject<JsonWireShape<S>>;

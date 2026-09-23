/**
 * @atlas
 * @kind helper
 * @partOf feature:segment
 * @uses none
 */
import { z } from '@hono/zod-openapi';

const RANDOM_TAIL_DIGITS = 15;

const DIGITS_READ = 3;

export const SAMPLE_OFFSETS = RANDOM_TAIL_DIGITS - DIGITS_READ + 1;

const percentSchema = z.number().min(0).max(100);

const offsetSchema = z
  .number()
  .int()
  .min(0)
  .max(SAMPLE_OFFSETS - 1);

export const sampleRangeSchema = z
  .object({ from: percentSchema, to: percentSchema })
  .refine((range) => range.from < range.to, { message: 'from must be below to' });

export const sampleSchema = sampleRangeSchema.safeExtend({ offset: offsetSchema });

export const sampleInputSchema = sampleRangeSchema.safeExtend({ offset: offsetSchema.optional() });

export type Sample = z.infer<typeof sampleSchema>;

export const randomOffset = (): number => Math.floor(Math.random() * SAMPLE_OFFSETS);

export const offsetOf = (sample: unknown): number | undefined => {
  const parsed = sampleSchema.safeParse(sample);
  return parsed.success ? parsed.data.offset : undefined;
};

const hex = (id: string): string => id.replace(/-/g, '');

export const bucketOf = (id: string, offset: number): number => {
  const digits = hex(id);
  const end = digits.length - offset;
  return (parseInt(digits.slice(end - DIGITS_READ, end), 16) / 16 ** DIGITS_READ) * 100;
};

export const inSample = (id: string, sample: unknown): boolean => {
  const parsed = sampleSchema.safeParse(sample);
  if (!parsed.success) return true;
  const bucket = bucketOf(id, parsed.data.offset);
  return parsed.data.from <= bucket && bucket < parsed.data.to;
};

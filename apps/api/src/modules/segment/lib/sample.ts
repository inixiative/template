/**
 * @atlas
 * @kind helper
 * @partOf feature:featureFlag
 * @uses none
 */
import { z } from '@hono/zod-openapi';

const RANDOM_TAIL_DIGITS = 15;

const DIGITS_READ = 3;

export const SAMPLE_OFFSETS = RANDOM_TAIL_DIGITS - DIGITS_READ + 1;

const percentSchema = z.number().min(0).max(100);

export const sampleRangeSchema = z
  .object({ from: percentSchema, to: percentSchema })
  .refine((range) => range.from < range.to, { message: 'from must be below to' });

export type SampleRange = z.infer<typeof sampleRangeSchema>;

export const bucketOf = (id: string, offset: number): number => {
  const digits = id.replace(/-/g, '');
  const end = digits.length - offset;
  return (parseInt(digits.slice(end - DIGITS_READ, end), 16) / 16 ** DIGITS_READ) * 100;
};

export const inSample = (id: string, range: unknown, offset: number): boolean => {
  const parsed = sampleRangeSchema.safeParse(range);
  if (!parsed.success) return true;
  const bucket = bucketOf(id, offset);
  return parsed.data.from <= bucket && bucket < parsed.data.to;
};

import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { QueryModeSchema } from '../enums/QueryMode.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  equals: jsonSchema.optional(),
  path: z.string().array().optional(),
  mode: QueryModeSchema.optional(),
  string_contains: z.string().optional(),
  string_starts_with: z.string().optional(),
  string_ends_with: z.string().optional(),
  array_starts_with: jsonSchema.optional().nullable(),
  array_ends_with: jsonSchema.optional().nullable(),
  array_contains: jsonSchema.optional().nullable(),
  lt: jsonSchema.optional(),
  lte: jsonSchema.optional(),
  gt: jsonSchema.optional(),
  gte: jsonSchema.optional(),
  not: jsonSchema.optional()
}).strict();
export const NestedJsonNullableFilterObjectSchema: z.ZodType<Prisma.NestedJsonNullableFilter> = makeSchema() as unknown as z.ZodType<Prisma.NestedJsonNullableFilter>;
export const NestedJsonNullableFilterObjectZodSchema = makeSchema();

import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { QueryModeSchema } from '../enums/QueryMode.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedJsonFilterObjectSchema as NestedJsonFilterObjectSchema } from './NestedJsonFilter.schema'

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
  not: jsonSchema.optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedJsonFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedJsonFilterObjectSchema).optional()
}).strict();
export const JsonWithAggregatesFilterObjectSchema: z.ZodType<Prisma.JsonWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.JsonWithAggregatesFilter>;
export const JsonWithAggregatesFilterObjectZodSchema = makeSchema();

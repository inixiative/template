import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringWithAggregatesFilterObjectSchema as StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { DateTimeWithAggregatesFilterObjectSchema as DateTimeWithAggregatesFilterObjectSchema } from './DateTimeWithAggregatesFilter.schema';
import { StringNullableWithAggregatesFilterObjectSchema as StringNullableWithAggregatesFilterObjectSchema } from './StringNullableWithAggregatesFilter.schema';
import { BoolWithAggregatesFilterObjectSchema as BoolWithAggregatesFilterObjectSchema } from './BoolWithAggregatesFilter.schema';
import { JsonNullableWithAggregatesFilterObjectSchema as JsonNullableWithAggregatesFilterObjectSchema } from './JsonNullableWithAggregatesFilter.schema';
import { IntWithAggregatesFilterObjectSchema as IntWithAggregatesFilterObjectSchema } from './IntWithAggregatesFilter.schema'

const cronjobscalarwherewithaggregatesinputSchema = z.object({
  AND: z.union([z.lazy(() => CronJobScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => CronJobScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => CronJobScalarWhereWithAggregatesInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => CronJobScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => CronJobScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  name: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string()]).optional(),
  jobId: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string()]).optional(),
  description: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string()]).optional().nullable(),
  pattern: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string()]).optional(),
  enabled: z.union([z.lazy(() => BoolWithAggregatesFilterObjectSchema), z.boolean()]).optional(),
  handler: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string()]).optional(),
  payload: z.lazy(() => JsonNullableWithAggregatesFilterObjectSchema).optional(),
  maxAttempts: z.union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number().int()]).optional(),
  backoffMs: z.union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number().int()]).optional(),
  createdById: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(36)]).optional().nullable()
}).strict();
export const CronJobScalarWhereWithAggregatesInputObjectSchema: z.ZodType<Prisma.CronJobScalarWhereWithAggregatesInput> = cronjobscalarwherewithaggregatesinputSchema as unknown as z.ZodType<Prisma.CronJobScalarWhereWithAggregatesInput>;
export const CronJobScalarWhereWithAggregatesInputObjectZodSchema = cronjobscalarwherewithaggregatesinputSchema;

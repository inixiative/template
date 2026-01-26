import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { BoolFilterObjectSchema as BoolFilterObjectSchema } from './BoolFilter.schema';
import { JsonNullableFilterObjectSchema as JsonNullableFilterObjectSchema } from './JsonNullableFilter.schema';
import { IntFilterObjectSchema as IntFilterObjectSchema } from './IntFilter.schema';
import { UserNullableScalarRelationFilterObjectSchema as UserNullableScalarRelationFilterObjectSchema } from './UserNullableScalarRelationFilter.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const cronjobwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => CronJobWhereInputObjectSchema), z.lazy(() => CronJobWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => CronJobWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => CronJobWhereInputObjectSchema), z.lazy(() => CronJobWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  name: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  jobId: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  description: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  pattern: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  enabled: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  handler: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  payload: z.lazy(() => JsonNullableFilterObjectSchema).optional(),
  maxAttempts: z.union([z.lazy(() => IntFilterObjectSchema), z.number().int()]).optional(),
  backoffMs: z.union([z.lazy(() => IntFilterObjectSchema), z.number().int()]).optional(),
  createdById: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  createdBy: z.union([z.lazy(() => UserNullableScalarRelationFilterObjectSchema), z.lazy(() => UserWhereInputObjectSchema)]).optional()
}).strict();
export const CronJobWhereInputObjectSchema: z.ZodType<Prisma.CronJobWhereInput> = cronjobwhereinputSchema as unknown as z.ZodType<Prisma.CronJobWhereInput>;
export const CronJobWhereInputObjectZodSchema = cronjobwhereinputSchema;

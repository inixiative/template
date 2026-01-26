import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { UserCreateNestedOneWithoutCronJobsCreatedInputObjectSchema as UserCreateNestedOneWithoutCronJobsCreatedInputObjectSchema } from './UserCreateNestedOneWithoutCronJobsCreatedInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  name: z.string(),
  jobId: z.string(),
  description: z.string().optional().nullable(),
  pattern: z.string(),
  enabled: z.boolean().optional(),
  handler: z.string(),
  payload: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  maxAttempts: z.number().int().optional(),
  backoffMs: z.number().int().optional(),
  createdBy: z.lazy(() => UserCreateNestedOneWithoutCronJobsCreatedInputObjectSchema).optional()
}).strict();
export const CronJobCreateInputObjectSchema: z.ZodType<Prisma.CronJobCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobCreateInput>;
export const CronJobCreateInputObjectZodSchema = makeSchema();

import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  name: z.string(),
  jobId: z.string(),
  description: z.string().optional().nullable(),
  pattern: z.string(),
  enabled: z.boolean().optional(),
  handler: z.string(),
  payload: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  maxAttempts: z.number().int().optional(),
  backoffMs: z.number().int().optional()
}).strict();
export const CronJobCreateWithoutCreatedByInputObjectSchema: z.ZodType<Prisma.CronJobCreateWithoutCreatedByInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobCreateWithoutCreatedByInput>;
export const CronJobCreateWithoutCreatedByInputObjectZodSchema = makeSchema();

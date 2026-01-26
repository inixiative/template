import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().optional(),
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
export const CronJobUncheckedCreateWithoutCreatedByInputObjectSchema: z.ZodType<Prisma.CronJobUncheckedCreateWithoutCreatedByInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobUncheckedCreateWithoutCreatedByInput>;
export const CronJobUncheckedCreateWithoutCreatedByInputObjectZodSchema = makeSchema();

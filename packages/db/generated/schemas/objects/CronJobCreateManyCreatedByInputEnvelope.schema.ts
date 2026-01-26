import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { CronJobCreateManyCreatedByInputObjectSchema as CronJobCreateManyCreatedByInputObjectSchema } from './CronJobCreateManyCreatedByInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => CronJobCreateManyCreatedByInputObjectSchema), z.lazy(() => CronJobCreateManyCreatedByInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const CronJobCreateManyCreatedByInputEnvelopeObjectSchema: z.ZodType<Prisma.CronJobCreateManyCreatedByInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.CronJobCreateManyCreatedByInputEnvelope>;
export const CronJobCreateManyCreatedByInputEnvelopeObjectZodSchema = makeSchema();

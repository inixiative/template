import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  name: z.string().optional(),
  jobId: z.string().optional()
}).strict();
export const CronJobWhereUniqueInputObjectSchema: z.ZodType<Prisma.CronJobWhereUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobWhereUniqueInput>;
export const CronJobWhereUniqueInputObjectZodSchema = makeSchema();

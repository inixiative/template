import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { CronJobCreateManyInputObjectSchema as CronJobCreateManyInputObjectSchema } from './objects/CronJobCreateManyInput.schema';

export const CronJobCreateManySchema: z.ZodType<Prisma.CronJobCreateManyArgs> = z.object({ data: z.union([ CronJobCreateManyInputObjectSchema, z.array(CronJobCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.CronJobCreateManyArgs>;

export const CronJobCreateManyZodSchema = z.object({ data: z.union([ CronJobCreateManyInputObjectSchema, z.array(CronJobCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();
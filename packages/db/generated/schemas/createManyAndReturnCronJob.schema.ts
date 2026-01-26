import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { CronJobSelectObjectSchema as CronJobSelectObjectSchema } from './objects/CronJobSelect.schema';
import { CronJobCreateManyInputObjectSchema as CronJobCreateManyInputObjectSchema } from './objects/CronJobCreateManyInput.schema';

export const CronJobCreateManyAndReturnSchema: z.ZodType<Prisma.CronJobCreateManyAndReturnArgs> = z.object({ select: CronJobSelectObjectSchema.optional(), data: z.union([ CronJobCreateManyInputObjectSchema, z.array(CronJobCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.CronJobCreateManyAndReturnArgs>;

export const CronJobCreateManyAndReturnZodSchema = z.object({ select: CronJobSelectObjectSchema.optional(), data: z.union([ CronJobCreateManyInputObjectSchema, z.array(CronJobCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();
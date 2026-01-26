import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { CronJobWhereInputObjectSchema as CronJobWhereInputObjectSchema } from './objects/CronJobWhereInput.schema';

export const CronJobDeleteManySchema: z.ZodType<Prisma.CronJobDeleteManyArgs> = z.object({ where: CronJobWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.CronJobDeleteManyArgs>;

export const CronJobDeleteManyZodSchema = z.object({ where: CronJobWhereInputObjectSchema.optional() }).strict();
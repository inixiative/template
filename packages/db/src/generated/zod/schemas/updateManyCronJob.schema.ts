import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { CronJobUpdateManyMutationInputObjectSchema as CronJobUpdateManyMutationInputObjectSchema } from './objects/CronJobUpdateManyMutationInput.schema';
import { CronJobWhereInputObjectSchema as CronJobWhereInputObjectSchema } from './objects/CronJobWhereInput.schema';

export const CronJobUpdateManySchema: z.ZodType<Prisma.CronJobUpdateManyArgs> = z.object({ data: CronJobUpdateManyMutationInputObjectSchema, where: CronJobWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.CronJobUpdateManyArgs>;

export const CronJobUpdateManyZodSchema = z.object({ data: CronJobUpdateManyMutationInputObjectSchema, where: CronJobWhereInputObjectSchema.optional() }).strict();
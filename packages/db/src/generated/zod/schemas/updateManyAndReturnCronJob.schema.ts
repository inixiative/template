import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { CronJobSelectObjectSchema as CronJobSelectObjectSchema } from './objects/CronJobSelect.schema';
import { CronJobUpdateManyMutationInputObjectSchema as CronJobUpdateManyMutationInputObjectSchema } from './objects/CronJobUpdateManyMutationInput.schema';
import { CronJobWhereInputObjectSchema as CronJobWhereInputObjectSchema } from './objects/CronJobWhereInput.schema';

export const CronJobUpdateManyAndReturnSchema: z.ZodType<Prisma.CronJobUpdateManyAndReturnArgs> = z.object({ select: CronJobSelectObjectSchema.optional(), data: CronJobUpdateManyMutationInputObjectSchema, where: CronJobWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.CronJobUpdateManyAndReturnArgs>;

export const CronJobUpdateManyAndReturnZodSchema = z.object({ select: CronJobSelectObjectSchema.optional(), data: CronJobUpdateManyMutationInputObjectSchema, where: CronJobWhereInputObjectSchema.optional() }).strict();
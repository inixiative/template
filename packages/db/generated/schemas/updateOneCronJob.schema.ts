import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { CronJobSelectObjectSchema as CronJobSelectObjectSchema } from './objects/CronJobSelect.schema';
import { CronJobIncludeObjectSchema as CronJobIncludeObjectSchema } from './objects/CronJobInclude.schema';
import { CronJobUpdateInputObjectSchema as CronJobUpdateInputObjectSchema } from './objects/CronJobUpdateInput.schema';
import { CronJobUncheckedUpdateInputObjectSchema as CronJobUncheckedUpdateInputObjectSchema } from './objects/CronJobUncheckedUpdateInput.schema';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './objects/CronJobWhereUniqueInput.schema';

export const CronJobUpdateOneSchema: z.ZodType<Prisma.CronJobUpdateArgs> = z.object({ select: CronJobSelectObjectSchema.optional(), include: CronJobIncludeObjectSchema.optional(), data: z.union([CronJobUpdateInputObjectSchema, CronJobUncheckedUpdateInputObjectSchema]), where: CronJobWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.CronJobUpdateArgs>;

export const CronJobUpdateOneZodSchema = z.object({ select: CronJobSelectObjectSchema.optional(), include: CronJobIncludeObjectSchema.optional(), data: z.union([CronJobUpdateInputObjectSchema, CronJobUncheckedUpdateInputObjectSchema]), where: CronJobWhereUniqueInputObjectSchema }).strict();
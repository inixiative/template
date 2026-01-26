import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { CronJobSelectObjectSchema as CronJobSelectObjectSchema } from './objects/CronJobSelect.schema';
import { CronJobIncludeObjectSchema as CronJobIncludeObjectSchema } from './objects/CronJobInclude.schema';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './objects/CronJobWhereUniqueInput.schema';

export const CronJobFindUniqueOrThrowSchema: z.ZodType<Prisma.CronJobFindUniqueOrThrowArgs> = z.object({ select: CronJobSelectObjectSchema.optional(), include: CronJobIncludeObjectSchema.optional(), where: CronJobWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.CronJobFindUniqueOrThrowArgs>;

export const CronJobFindUniqueOrThrowZodSchema = z.object({ select: CronJobSelectObjectSchema.optional(), include: CronJobIncludeObjectSchema.optional(), where: CronJobWhereUniqueInputObjectSchema }).strict();
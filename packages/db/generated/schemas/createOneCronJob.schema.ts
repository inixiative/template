import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { CronJobSelectObjectSchema as CronJobSelectObjectSchema } from './objects/CronJobSelect.schema';
import { CronJobIncludeObjectSchema as CronJobIncludeObjectSchema } from './objects/CronJobInclude.schema';
import { CronJobCreateInputObjectSchema as CronJobCreateInputObjectSchema } from './objects/CronJobCreateInput.schema';
import { CronJobUncheckedCreateInputObjectSchema as CronJobUncheckedCreateInputObjectSchema } from './objects/CronJobUncheckedCreateInput.schema';

export const CronJobCreateOneSchema: z.ZodType<Prisma.CronJobCreateArgs> = z.object({ select: CronJobSelectObjectSchema.optional(), include: CronJobIncludeObjectSchema.optional(), data: z.union([CronJobCreateInputObjectSchema, CronJobUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.CronJobCreateArgs>;

export const CronJobCreateOneZodSchema = z.object({ select: CronJobSelectObjectSchema.optional(), include: CronJobIncludeObjectSchema.optional(), data: z.union([CronJobCreateInputObjectSchema, CronJobUncheckedCreateInputObjectSchema]) }).strict();
import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { CronJobSelectObjectSchema as CronJobSelectObjectSchema } from './objects/CronJobSelect.schema';
import { CronJobIncludeObjectSchema as CronJobIncludeObjectSchema } from './objects/CronJobInclude.schema';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './objects/CronJobWhereUniqueInput.schema';
import { CronJobCreateInputObjectSchema as CronJobCreateInputObjectSchema } from './objects/CronJobCreateInput.schema';
import { CronJobUncheckedCreateInputObjectSchema as CronJobUncheckedCreateInputObjectSchema } from './objects/CronJobUncheckedCreateInput.schema';
import { CronJobUpdateInputObjectSchema as CronJobUpdateInputObjectSchema } from './objects/CronJobUpdateInput.schema';
import { CronJobUncheckedUpdateInputObjectSchema as CronJobUncheckedUpdateInputObjectSchema } from './objects/CronJobUncheckedUpdateInput.schema';

export const CronJobUpsertOneSchema: z.ZodType<Prisma.CronJobUpsertArgs> = z.object({ select: CronJobSelectObjectSchema.optional(), include: CronJobIncludeObjectSchema.optional(), where: CronJobWhereUniqueInputObjectSchema, create: z.union([ CronJobCreateInputObjectSchema, CronJobUncheckedCreateInputObjectSchema ]), update: z.union([ CronJobUpdateInputObjectSchema, CronJobUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.CronJobUpsertArgs>;

export const CronJobUpsertOneZodSchema = z.object({ select: CronJobSelectObjectSchema.optional(), include: CronJobIncludeObjectSchema.optional(), where: CronJobWhereUniqueInputObjectSchema, create: z.union([ CronJobCreateInputObjectSchema, CronJobUncheckedCreateInputObjectSchema ]), update: z.union([ CronJobUpdateInputObjectSchema, CronJobUncheckedUpdateInputObjectSchema ]) }).strict();
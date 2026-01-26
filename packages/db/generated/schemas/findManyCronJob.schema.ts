import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { CronJobIncludeObjectSchema as CronJobIncludeObjectSchema } from './objects/CronJobInclude.schema';
import { CronJobOrderByWithRelationInputObjectSchema as CronJobOrderByWithRelationInputObjectSchema } from './objects/CronJobOrderByWithRelationInput.schema';
import { CronJobWhereInputObjectSchema as CronJobWhereInputObjectSchema } from './objects/CronJobWhereInput.schema';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './objects/CronJobWhereUniqueInput.schema';
import { CronJobScalarFieldEnumSchema } from './enums/CronJobScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const CronJobFindManySelectSchema: z.ZodType<Prisma.CronJobSelect> = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    name: z.boolean().optional(),
    jobId: z.boolean().optional(),
    description: z.boolean().optional(),
    pattern: z.boolean().optional(),
    enabled: z.boolean().optional(),
    handler: z.boolean().optional(),
    payload: z.boolean().optional(),
    maxAttempts: z.boolean().optional(),
    backoffMs: z.boolean().optional(),
    createdById: z.boolean().optional(),
    createdBy: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.CronJobSelect>;

export const CronJobFindManySelectZodSchema = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    name: z.boolean().optional(),
    jobId: z.boolean().optional(),
    description: z.boolean().optional(),
    pattern: z.boolean().optional(),
    enabled: z.boolean().optional(),
    handler: z.boolean().optional(),
    payload: z.boolean().optional(),
    maxAttempts: z.boolean().optional(),
    backoffMs: z.boolean().optional(),
    createdById: z.boolean().optional(),
    createdBy: z.boolean().optional()
  }).strict();

export const CronJobFindManySchema: z.ZodType<Prisma.CronJobFindManyArgs> = z.object({ select: CronJobFindManySelectSchema.optional(), include: z.lazy(() => CronJobIncludeObjectSchema.optional()), orderBy: z.union([CronJobOrderByWithRelationInputObjectSchema, CronJobOrderByWithRelationInputObjectSchema.array()]).optional(), where: CronJobWhereInputObjectSchema.optional(), cursor: CronJobWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([CronJobScalarFieldEnumSchema, CronJobScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.CronJobFindManyArgs>;

export const CronJobFindManyZodSchema = z.object({ select: CronJobFindManySelectSchema.optional(), include: z.lazy(() => CronJobIncludeObjectSchema.optional()), orderBy: z.union([CronJobOrderByWithRelationInputObjectSchema, CronJobOrderByWithRelationInputObjectSchema.array()]).optional(), where: CronJobWhereInputObjectSchema.optional(), cursor: CronJobWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([CronJobScalarFieldEnumSchema, CronJobScalarFieldEnumSchema.array()]).optional() }).strict();
import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationIncludeObjectSchema as OrganizationIncludeObjectSchema } from './objects/OrganizationInclude.schema';
import { OrganizationOrderByWithRelationInputObjectSchema as OrganizationOrderByWithRelationInputObjectSchema } from './objects/OrganizationOrderByWithRelationInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './objects/OrganizationWhereInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './objects/OrganizationWhereUniqueInput.schema';
import { OrganizationScalarFieldEnumSchema } from './enums/OrganizationScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const OrganizationFindManySelectSchema: z.ZodType<Prisma.OrganizationSelect> = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    deletedAt: z.boolean().optional(),
    name: z.boolean().optional(),
    slug: z.boolean().optional(),
    users: z.boolean().optional(),
    tokens: z.boolean().optional(),
    webhookSubscriptions: z.boolean().optional(),
    inquiriesSent: z.boolean().optional(),
    inquiriesReceived: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.OrganizationSelect>;

export const OrganizationFindManySelectZodSchema = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    deletedAt: z.boolean().optional(),
    name: z.boolean().optional(),
    slug: z.boolean().optional(),
    users: z.boolean().optional(),
    tokens: z.boolean().optional(),
    webhookSubscriptions: z.boolean().optional(),
    inquiriesSent: z.boolean().optional(),
    inquiriesReceived: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict();

export const OrganizationFindManySchema: z.ZodType<Prisma.OrganizationFindManyArgs> = z.object({ select: OrganizationFindManySelectSchema.optional(), include: z.lazy(() => OrganizationIncludeObjectSchema.optional()), orderBy: z.union([OrganizationOrderByWithRelationInputObjectSchema, OrganizationOrderByWithRelationInputObjectSchema.array()]).optional(), where: OrganizationWhereInputObjectSchema.optional(), cursor: OrganizationWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([OrganizationScalarFieldEnumSchema, OrganizationScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationFindManyArgs>;

export const OrganizationFindManyZodSchema = z.object({ select: OrganizationFindManySelectSchema.optional(), include: z.lazy(() => OrganizationIncludeObjectSchema.optional()), orderBy: z.union([OrganizationOrderByWithRelationInputObjectSchema, OrganizationOrderByWithRelationInputObjectSchema.array()]).optional(), where: OrganizationWhereInputObjectSchema.optional(), cursor: OrganizationWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([OrganizationScalarFieldEnumSchema, OrganizationScalarFieldEnumSchema.array()]).optional() }).strict();
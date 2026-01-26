import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { TokenIncludeObjectSchema as TokenIncludeObjectSchema } from './objects/TokenInclude.schema';
import { TokenOrderByWithRelationInputObjectSchema as TokenOrderByWithRelationInputObjectSchema } from './objects/TokenOrderByWithRelationInput.schema';
import { TokenWhereInputObjectSchema as TokenWhereInputObjectSchema } from './objects/TokenWhereInput.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './objects/TokenWhereUniqueInput.schema';
import { TokenScalarFieldEnumSchema } from './enums/TokenScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const TokenFindManySelectSchema: z.ZodType<Prisma.TokenSelect> = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    name: z.boolean().optional(),
    keyHash: z.boolean().optional(),
    keyPrefix: z.boolean().optional(),
    ownerModel: z.boolean().optional(),
    userId: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    user: z.boolean().optional(),
    organization: z.boolean().optional(),
    organizationUser: z.boolean().optional(),
    role: z.boolean().optional(),
    entitlements: z.boolean().optional(),
    expiresAt: z.boolean().optional(),
    lastUsedAt: z.boolean().optional(),
    isActive: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.TokenSelect>;

export const TokenFindManySelectZodSchema = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    name: z.boolean().optional(),
    keyHash: z.boolean().optional(),
    keyPrefix: z.boolean().optional(),
    ownerModel: z.boolean().optional(),
    userId: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    user: z.boolean().optional(),
    organization: z.boolean().optional(),
    organizationUser: z.boolean().optional(),
    role: z.boolean().optional(),
    entitlements: z.boolean().optional(),
    expiresAt: z.boolean().optional(),
    lastUsedAt: z.boolean().optional(),
    isActive: z.boolean().optional()
  }).strict();

export const TokenFindManySchema: z.ZodType<Prisma.TokenFindManyArgs> = z.object({ select: TokenFindManySelectSchema.optional(), include: z.lazy(() => TokenIncludeObjectSchema.optional()), orderBy: z.union([TokenOrderByWithRelationInputObjectSchema, TokenOrderByWithRelationInputObjectSchema.array()]).optional(), where: TokenWhereInputObjectSchema.optional(), cursor: TokenWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([TokenScalarFieldEnumSchema, TokenScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.TokenFindManyArgs>;

export const TokenFindManyZodSchema = z.object({ select: TokenFindManySelectSchema.optional(), include: z.lazy(() => TokenIncludeObjectSchema.optional()), orderBy: z.union([TokenOrderByWithRelationInputObjectSchema, TokenOrderByWithRelationInputObjectSchema.array()]).optional(), where: TokenWhereInputObjectSchema.optional(), cursor: TokenWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([TokenScalarFieldEnumSchema, TokenScalarFieldEnumSchema.array()]).optional() }).strict();
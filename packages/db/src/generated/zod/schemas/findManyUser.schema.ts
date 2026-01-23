import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { UserOrderByWithRelationInputObjectSchema as UserOrderByWithRelationInputObjectSchema } from './objects/UserOrderByWithRelationInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './objects/UserWhereInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './objects/UserWhereUniqueInput.schema';
import { UserScalarFieldEnumSchema } from './enums/UserScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const UserFindManySelectSchema: z.ZodType<Prisma.UserSelect> = z.object({
    id: z.boolean().optional(),
    email: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    passwordHash: z.boolean().optional(),
    name: z.boolean().optional(),
    avatarUrl: z.boolean().optional(),
    kycStatus: z.boolean().optional(),
    kycProvider: z.boolean().optional(),
    kycExternalId: z.boolean().optional(),
    kycVerifiedAt: z.boolean().optional(),
    region: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    sessions: z.boolean().optional(),
    wallets: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.UserSelect>;

export const UserFindManySelectZodSchema = z.object({
    id: z.boolean().optional(),
    email: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    passwordHash: z.boolean().optional(),
    name: z.boolean().optional(),
    avatarUrl: z.boolean().optional(),
    kycStatus: z.boolean().optional(),
    kycProvider: z.boolean().optional(),
    kycExternalId: z.boolean().optional(),
    kycVerifiedAt: z.boolean().optional(),
    region: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    sessions: z.boolean().optional(),
    wallets: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict();

export const UserFindManySchema: z.ZodType<Prisma.UserFindManyArgs> = z.object({ select: UserFindManySelectSchema.optional(),  orderBy: z.union([UserOrderByWithRelationInputObjectSchema, UserOrderByWithRelationInputObjectSchema.array()]).optional(), where: UserWhereInputObjectSchema.optional(), cursor: UserWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([UserScalarFieldEnumSchema, UserScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.UserFindManyArgs>;

export const UserFindManyZodSchema = z.object({ select: UserFindManySelectSchema.optional(),  orderBy: z.union([UserOrderByWithRelationInputObjectSchema, UserOrderByWithRelationInputObjectSchema.array()]).optional(), where: UserWhereInputObjectSchema.optional(), cursor: UserWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([UserScalarFieldEnumSchema, UserScalarFieldEnumSchema.array()]).optional() }).strict();
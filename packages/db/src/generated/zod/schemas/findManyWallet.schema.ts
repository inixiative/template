import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletOrderByWithRelationInputObjectSchema as WalletOrderByWithRelationInputObjectSchema } from './objects/WalletOrderByWithRelationInput.schema';
import { WalletWhereInputObjectSchema as WalletWhereInputObjectSchema } from './objects/WalletWhereInput.schema';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './objects/WalletWhereUniqueInput.schema';
import { WalletScalarFieldEnumSchema } from './enums/WalletScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const WalletFindManySelectSchema: z.ZodType<Prisma.WalletSelect> = z.object({
    id: z.boolean().optional(),
    userId: z.boolean().optional(),
    address: z.boolean().optional(),
    chain: z.boolean().optional(),
    isPrimary: z.boolean().optional(),
    isPayoutWallet: z.boolean().optional(),
    verifiedAt: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    user: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.WalletSelect>;

export const WalletFindManySelectZodSchema = z.object({
    id: z.boolean().optional(),
    userId: z.boolean().optional(),
    address: z.boolean().optional(),
    chain: z.boolean().optional(),
    isPrimary: z.boolean().optional(),
    isPayoutWallet: z.boolean().optional(),
    verifiedAt: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    user: z.boolean().optional()
  }).strict();

export const WalletFindManySchema: z.ZodType<Prisma.WalletFindManyArgs> = z.object({ select: WalletFindManySelectSchema.optional(),  orderBy: z.union([WalletOrderByWithRelationInputObjectSchema, WalletOrderByWithRelationInputObjectSchema.array()]).optional(), where: WalletWhereInputObjectSchema.optional(), cursor: WalletWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WalletScalarFieldEnumSchema, WalletScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.WalletFindManyArgs>;

export const WalletFindManyZodSchema = z.object({ select: WalletFindManySelectSchema.optional(),  orderBy: z.union([WalletOrderByWithRelationInputObjectSchema, WalletOrderByWithRelationInputObjectSchema.array()]).optional(), where: WalletWhereInputObjectSchema.optional(), cursor: WalletWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WalletScalarFieldEnumSchema, WalletScalarFieldEnumSchema.array()]).optional() }).strict();
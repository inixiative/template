import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletOrderByWithRelationInputObjectSchema as WalletOrderByWithRelationInputObjectSchema } from './objects/WalletOrderByWithRelationInput.schema';
import { WalletWhereInputObjectSchema as WalletWhereInputObjectSchema } from './objects/WalletWhereInput.schema';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './objects/WalletWhereUniqueInput.schema';
import { WalletScalarFieldEnumSchema } from './enums/WalletScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const WalletFindFirstSelectSchema: z.ZodType<Prisma.WalletSelect> = z.object({
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

export const WalletFindFirstSelectZodSchema = z.object({
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

export const WalletFindFirstSchema: z.ZodType<Prisma.WalletFindFirstArgs> = z.object({ select: WalletFindFirstSelectSchema.optional(),  orderBy: z.union([WalletOrderByWithRelationInputObjectSchema, WalletOrderByWithRelationInputObjectSchema.array()]).optional(), where: WalletWhereInputObjectSchema.optional(), cursor: WalletWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WalletScalarFieldEnumSchema, WalletScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.WalletFindFirstArgs>;

export const WalletFindFirstZodSchema = z.object({ select: WalletFindFirstSelectSchema.optional(),  orderBy: z.union([WalletOrderByWithRelationInputObjectSchema, WalletOrderByWithRelationInputObjectSchema.array()]).optional(), where: WalletWhereInputObjectSchema.optional(), cursor: WalletWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WalletScalarFieldEnumSchema, WalletScalarFieldEnumSchema.array()]).optional() }).strict();
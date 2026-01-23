import * as z from 'zod';
export const WalletAggregateResultSchema = z.object({  _count: z.object({
    id: z.number(),
    userId: z.number(),
    address: z.number(),
    chain: z.number(),
    isPrimary: z.number(),
    isPayoutWallet: z.number(),
    verifiedAt: z.number(),
    createdAt: z.number(),
    user: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    userId: z.string().nullable(),
    address: z.string().nullable(),
    verifiedAt: z.date().nullable(),
    createdAt: z.date().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    userId: z.string().nullable(),
    address: z.string().nullable(),
    verifiedAt: z.date().nullable(),
    createdAt: z.date().nullable()
  }).nullable().optional()});
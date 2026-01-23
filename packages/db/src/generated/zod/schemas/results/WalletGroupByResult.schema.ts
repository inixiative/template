import * as z from 'zod';
export const WalletGroupByResultSchema = z.array(z.object({
  id: z.string(),
  userId: z.string(),
  address: z.string(),
  isPrimary: z.boolean(),
  isPayoutWallet: z.boolean(),
  verifiedAt: z.date(),
  createdAt: z.date(),
  _count: z.object({
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
  }).nullable().optional()
}));
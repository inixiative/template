import * as z from 'zod';
export const WalletFindManyResultSchema = z.object({
  data: z.array(z.object({
  id: z.string(),
  userId: z.string(),
  address: z.string(),
  chain: z.unknown(),
  isPrimary: z.boolean(),
  isPayoutWallet: z.boolean(),
  verifiedAt: z.date().optional(),
  createdAt: z.date(),
  user: z.unknown()
})),
  pagination: z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
})
});
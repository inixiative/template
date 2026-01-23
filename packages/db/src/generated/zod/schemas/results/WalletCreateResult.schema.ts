import * as z from 'zod';
export const WalletCreateResultSchema = z.object({
  id: z.string(),
  userId: z.string(),
  address: z.string(),
  chain: z.unknown(),
  isPrimary: z.boolean(),
  isPayoutWallet: z.boolean(),
  verifiedAt: z.date().optional(),
  createdAt: z.date(),
  user: z.unknown()
});
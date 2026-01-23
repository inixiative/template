import * as z from 'zod';
export const WalletDeleteManyResultSchema = z.object({
  count: z.number()
});
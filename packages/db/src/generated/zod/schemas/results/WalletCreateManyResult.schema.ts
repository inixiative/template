import * as z from 'zod';
export const WalletCreateManyResultSchema = z.object({
  count: z.number()
});
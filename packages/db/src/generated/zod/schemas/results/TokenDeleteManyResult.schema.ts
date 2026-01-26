import * as z from 'zod';
export const TokenDeleteManyResultSchema = z.object({
  count: z.number()
});
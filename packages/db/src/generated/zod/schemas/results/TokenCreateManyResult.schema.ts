import * as z from 'zod';
export const TokenCreateManyResultSchema = z.object({
  count: z.number()
});
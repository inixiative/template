import { z } from 'zod';

export const baseResolutionSchema = z.object({
  explanation: z.string().optional(),
});

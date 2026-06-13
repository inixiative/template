/**
 * @atlas
 * @kind handler, schema
 * @partOf feature:inquiry
 * @uses none
 */
import { z } from 'zod';

export const baseResolutionInputSchema = z.object({
  explanation: z.string().optional(),
});

export type BaseResolution = z.infer<typeof baseResolutionInputSchema>;

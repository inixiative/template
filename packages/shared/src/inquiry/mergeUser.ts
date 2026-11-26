/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { baseResolutionInputSchema } from '@template/shared/inquiry/baseResolution';
import { z } from 'zod';

export const mergeUserContentSchema = z.object({
  sourceUser: z.object({ id: z.string(), email: z.string() }),
});

export const mergeUserResolutionInputSchema = baseResolutionInputSchema.extend({
  sourceUser: mergeUserContentSchema.shape.sourceUser.optional(),
});

export type MergeUserContent = z.infer<typeof mergeUserContentSchema>;
export type MergeUserResolutionInput = z.infer<typeof mergeUserResolutionInputSchema>;

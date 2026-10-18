/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry, feature:files
 * @uses none
 */
import { z } from 'zod';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';

export const transferArtifactContentSchema = z.object({
  artifactId: z.string(),
  keepTracking: z.boolean().default(false),
  allowTracking: z.boolean().optional(),
});

export type TransferArtifactContent = z.infer<typeof transferArtifactContentSchema>;

export const transferArtifactResolutionInputSchema = baseResolutionInputSchema.extend({
  allowTracking: z.boolean().optional(),
});

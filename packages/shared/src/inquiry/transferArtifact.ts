/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry, feature:files
 * @uses none
 */

import { baseResolutionInputSchema } from '@template/shared/inquiry/baseResolution';
import { z } from 'zod';

export const transferArtifactContentSchema = z.object({
  artifactId: z.string(),
  keepTracking: z.boolean().default(false),
  allowTracking: z.boolean().optional(),
});

export type TransferArtifactContent = z.infer<typeof transferArtifactContentSchema>;

export const transferArtifactResolutionInputSchema = baseResolutionInputSchema.extend({
  allowTracking: z.boolean().optional(),
});

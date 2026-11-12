/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { baseResolutionInputSchema } from '@template/shared/inquiry/baseResolution';
import { z } from 'zod';

export const spaceContentSchema = z.object({
  name: z.string(),
  slug: z.string(),
});

export const createSpaceResolutionSchema = baseResolutionInputSchema.extend({
  spaceId: z.string().optional(),
});

export type SpaceContent = z.infer<typeof spaceContentSchema>;
export type CreateSpaceResolution = z.infer<typeof createSpaceResolutionSchema>;

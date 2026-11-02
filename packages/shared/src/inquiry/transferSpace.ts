/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { baseResolutionInputSchema } from '@template/shared/inquiry/baseResolution';
import { spaceContentSchema } from '@template/shared/inquiry/createSpace';
import type { z } from 'zod';

export const transferSpaceContentSchema = spaceContentSchema.pick({ slug: true }).partial();

export const transferSpaceResolutionInputSchema = baseResolutionInputSchema.extend(
  transferSpaceContentSchema.shape,
);

export type TransferSpaceContent = z.infer<typeof transferSpaceContentSchema>;

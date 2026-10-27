/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { spaceContentSchema } from '@template/shared/inquiry/createSpace';
import type { z } from 'zod';

export const updateSpaceContentSchema = spaceContentSchema.partial();

export type UpdateSpaceContent = z.infer<typeof updateSpaceContentSchema>;
